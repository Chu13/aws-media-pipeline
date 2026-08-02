import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import { Construct } from "constructs";
import { createBuckets } from "./constructs/buckets";
import { createCleanup } from "./constructs/cleanup";
import { createDistribution } from "./constructs/distribution";
import { createPresignLambda } from "./constructs/presign-lambda";
import { createProcessLambda } from "./constructs/process-lambda";
import { createRateLimitTable } from "./constructs/rate-limit-table";

/**
 * Level 06 — serverless media pipeline.
 *
 * A single CloudFront distribution fronts everything (default -> site,
 * /r/* -> outputs, /api/* -> the presign Lambda), so the app is
 * same-origin end to end. Flow: browser calls GET /api/presign (validated,
 * rate-limited by IP via DynamoDB) -> PUTs the file directly to the
 * uploads bucket with the returned presigned URL -> that ObjectCreated
 * event triggers the process Lambda (sharp) -> which writes 6 WebP/AVIF
 * variants plus a manifest.json the frontend polls through CloudFront. An
 * EventBridge-scheduled sweeper deletes anything older than an hour from
 * both buckets, backed by a 1-day S3 Lifecycle rule as a backstop.
 */
export class MediaPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const buckets = createBuckets(this);
    const rateLimitTable = createRateLimitTable(this);

    const processFn = createProcessLambda(this, {
      uploadsBucket: buckets.uploads,
      outputsBucket: buckets.outputs,
    });
    buckets.uploads.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.LambdaDestination(processFn), {
      prefix: "uploads/",
    });

    createCleanup(this, { uploadsBucket: buckets.uploads, outputsBucket: buckets.outputs });

    const { fn: presignFn, fnUrl: presignFnUrl } = createPresignLambda(this, {
      uploadsBucket: buckets.uploads,
      rateLimitTable,
    });

    const distribution = createDistribution(this, {
      siteBucket: buckets.site,
      outputsBucket: buckets.outputs,
      presignFn,
      presignFnUrl,
    });

    new cdk.CfnOutput(this, "SiteUrl", { value: `https://${distribution.distributionDomainName}` });
    new cdk.CfnOutput(this, "DistributionId", { value: distribution.distributionId });
    new cdk.CfnOutput(this, "UploadsBucketName", { value: buckets.uploads.bucketName });
    new cdk.CfnOutput(this, "OutputsBucketName", { value: buckets.outputs.bucketName });
    new cdk.CfnOutput(this, "SiteBucketName", { value: buckets.site.bucketName });
  }
}
