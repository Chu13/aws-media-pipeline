import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as path from "path";
import { Construct } from "constructs";

export interface PresignLambdaProps {
  uploadsBucket: s3.Bucket;
  rateLimitTable: dynamodb.Table;
}

export interface PresignLambda {
  fn: lambdaNode.NodejsFunction;
  fnUrl: lambda.FunctionUrl;
}

/**
 * A GET-only Lambda Function URL, IAM-authenticated so only CloudFront's
 * OAC can invoke it directly (see constructs/distribution.ts for the
 * matching addPermission grants) — never callable straight from the
 * public internet.
 */
export function createPresignLambda(scope: Construct, props: PresignLambdaProps): PresignLambda {
  const logGroup = new logs.LogGroup(scope, "PresignFnLogGroup", {
    retention: logs.RetentionDays.ONE_WEEK,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
  });

  const fn = new lambdaNode.NodejsFunction(scope, "PresignFn", {
    entry: path.join(__dirname, "../../../lambdas/presign/src/handler.ts"),
    runtime: lambda.Runtime.NODEJS_22_X,
    architecture: lambda.Architecture.ARM_64,
    memorySize: 256,
    timeout: cdk.Duration.seconds(10),
    depsLockFilePath: path.join(__dirname, "../../../package-lock.json"),
    environment: {
      UPLOADS_BUCKET: props.uploadsBucket.bucketName,
      RATE_LIMIT_TABLE: props.rateLimitTable.tableName,
    },
    logGroup,
  });

  props.uploadsBucket.grantPut(fn, "uploads/*");
  // Only the one atomic-increment action this Lambda actually performs —
  // not grantWriteData(), which would also hand out PutItem/DeleteItem.
  props.rateLimitTable.grant(fn, "dynamodb:UpdateItem");

  const fnUrl = fn.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.AWS_IAM });

  return { fn, fnUrl };
}
