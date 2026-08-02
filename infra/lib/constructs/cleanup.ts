import * as cdk from "aws-cdk-lib";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as path from "path";
import { Construct } from "constructs";

export interface CleanupProps {
  uploadsBucket: s3.Bucket;
  outputsBucket: s3.Bucket;
}

const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour — the promise the UI makes

/**
 * S3 Lifecycle expiration only supports whole-day granularity and only
 * evaluates once daily — it cannot express "1 hour" at all. This sweeper
 * runs every 10 minutes and deletes anything older than 60 minutes, which
 * is what actually makes the UI's "se autodestruye en 60 min" message
 * true (within the sweep interval). The 1-day lifecycle rules on both
 * buckets (constructs/buckets.ts) are a declarative backstop in case this
 * Lambda ever fails — a real Expiration rule genuinely exists, it just
 * isn't the primary mechanism.
 *
 * Deliberately a plain EventBridge rate rule declared in this stack
 * (not per-job EventBridge Scheduler one-time schedules created
 * imperatively at upload time) — schedules created by Lambda code at
 * runtime aren't tracked by CloudFormation, which cuts against this
 * project's own "cdk destroy leaves nothing behind" acceptance bar. This
 * trades a few minutes of precision for the whole pipeline staying
 * declarative.
 */
export function createCleanup(scope: Construct, props: CleanupProps): lambdaNode.NodejsFunction {
  const logGroup = new logs.LogGroup(scope, "CleanupFnLogGroup", {
    retention: logs.RetentionDays.ONE_WEEK,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
  });

  const fn = new lambdaNode.NodejsFunction(scope, "CleanupFn", {
    entry: path.join(__dirname, "../../../lambdas/cleanup/src/handler.ts"),
    runtime: lambda.Runtime.NODEJS_22_X,
    architecture: lambda.Architecture.ARM_64,
    memorySize: 256,
    timeout: cdk.Duration.minutes(2),
    depsLockFilePath: path.join(__dirname, "../../../package-lock.json"),
    environment: {
      UPLOADS_BUCKET: props.uploadsBucket.bucketName,
      OUTPUTS_BUCKET: props.outputsBucket.bucketName,
      MAX_AGE_MS: String(MAX_AGE_MS),
    },
    logGroup,
  });

  // Explicit statements, not bucket.grantRead()/grantReadWrite() — this
  // Lambda only ever lists (to find stale objects) and deletes, never
  // reads object bodies. ListBucket is bucket-level (no key-prefix scoping
  // is possible when the sweep must discover every job); DeleteObject is
  // scoped to objects.
  for (const bucket of [props.uploadsBucket, props.outputsBucket]) {
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:ListBucket"],
        resources: [bucket.bucketArn],
      }),
    );
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:DeleteObject"],
        resources: [bucket.arnForObjects("*")],
      }),
    );
  }

  new events.Rule(scope, "CleanupSchedule", {
    schedule: events.Schedule.rate(cdk.Duration.minutes(10)),
    targets: [new targets.LambdaFunction(fn)],
  });

  return fn;
}
