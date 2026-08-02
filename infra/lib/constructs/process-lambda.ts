import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as path from "path";
import { Construct } from "constructs";

export interface ProcessLambdaProps {
  uploadsBucket: s3.Bucket;
  outputsBucket: s3.Bucket;
}

/**
 * Triggered by S3 ObjectCreated on the uploads bucket. Uses sharp, which
 * needs Linux/arm64 native bindings — bindings that don't exist on a Mac
 * dev machine. NodejsFunction's Docker bundling (forced; `sharp` excluded
 * from the esbuild bundle and installed natively inside the Lambda build
 * container instead) produces those bindings reproducibly from `cdk
 * deploy` alone, with no separate layer-build script to hand-maintain.
 */
export function createProcessLambda(scope: Construct, props: ProcessLambdaProps): lambdaNode.NodejsFunction {
  const logGroup = new logs.LogGroup(scope, "ProcessFnLogGroup", {
    retention: logs.RetentionDays.ONE_WEEK,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
  });

  const fn = new lambdaNode.NodejsFunction(scope, "ProcessFn", {
    entry: path.join(__dirname, "../../../lambdas/process/src/handler.ts"),
    runtime: lambda.Runtime.NODEJS_22_X, // not 24.x — CDK/SAM bundling image support lags new major runtimes
    architecture: lambda.Architecture.ARM_64,
    // 3008MB is this account's Lambda memory ceiling (some accounts/regions
    // still cap at 3008 rather than the newer 10240 max — confirmed by a
    // failed deploy attempt at 4096). ~1.7 vCPU vs. 2048MB's ~1.15 (Lambda
    // allocates CPU proportional to memory, ~1,769MB per vCPU). Measured
    // against a real 3000x2000 photo at 2048MB: 6 variants encode fully
    // concurrently (see variants.ts), so 6 CPU-bound operations were
    // contending for barely more than 1 core and took ~24s. More memory is
    // the direct lever here, not less concurrency — it's cost-neutral for
    // CPU-bound work (higher rate, lower duration, similar total
    // GB-seconds) and "processes in seconds" is the whole point of the demo.
    memorySize: 3008,
    timeout: cdk.Duration.seconds(60),
    depsLockFilePath: path.join(__dirname, "../../../package-lock.json"),
    bundling: {
      forceDockerBundling: true,
      nodeModules: ["sharp"],
    },
    environment: {
      OUTPUTS_BUCKET: props.outputsBucket.bucketName,
    },
    logGroup,
  });

  // Scoped by prefix, not bucket.grantReadWrite() — this Lambda only ever
  // reads from uploads/* and writes to r/*, never the reverse.
  props.uploadsBucket.grantRead(fn, "uploads/*");
  props.outputsBucket.grantPut(fn, "r/*");

  return fn;
}
