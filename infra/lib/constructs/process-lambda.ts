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
    memorySize: 2048, // >1,769MB buys a full vCPU; AVIF encoding is the expensive step
    timeout: cdk.Duration.seconds(30),
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
