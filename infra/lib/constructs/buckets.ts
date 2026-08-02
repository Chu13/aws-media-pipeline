import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export interface PipelineBuckets {
  uploads: s3.Bucket;
  outputs: s3.Bucket;
  site: s3.Bucket;
}

/**
 * Three buckets, three different jobs:
 *  - uploads: the raw file the browser PUTs directly to via a presigned
 *    URL. Read only by the process Lambda, never served publicly.
 *  - outputs: the generated variants + manifest.json, served through
 *    CloudFront's /r/* behavior.
 *  - site: the static Vite build, served through CloudFront's default
 *    (/*) behavior.
 *
 * Both uploads and outputs get a 1-day lifecycle rule as a declarative
 * backstop. It is NOT the real cleanup mechanism: S3 Lifecycle expiration
 * only supports whole-day granularity — CDK itself throws at synth time
 * if you pass anything that isn't a whole number of days — so it cannot
 * express "1 hour" at all. The real ~60-minute deletion is the EventBridge
 * sweeper in constructs/cleanup.ts.
 */
export function createBuckets(scope: Construct): PipelineBuckets {
  const uploads = new s3.Bucket(scope, "UploadsBucket", {
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    encryption: s3.BucketEncryption.S3_MANAGED,
    enforceSSL: true,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
    autoDeleteObjects: true,
    lifecycleRules: [{ expiration: cdk.Duration.days(1) }],
    cors: [
      {
        // "*" rather than the CloudFront domain: the distribution's own
        // domain name isn't known until it's created, and it needs these
        // buckets as origins — a genuine circular reference. Presigned
        // URLs (short-lived, single-object, signature-checked) are the
        // real access-control boundary here, not CORS; an open origin on
        // a PUT-only rule with no credentialed requests doesn't weaken
        // that.
        allowedMethods: [s3.HttpMethods.PUT],
        allowedOrigins: ["*"],
        allowedHeaders: ["*"],
        maxAge: 3000,
      },
    ],
  });

  const outputs = new s3.Bucket(scope, "OutputsBucket", {
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    encryption: s3.BucketEncryption.S3_MANAGED,
    enforceSSL: true,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
    autoDeleteObjects: true,
    lifecycleRules: [{ expiration: cdk.Duration.days(1) }],
  });

  const site = new s3.Bucket(scope, "SiteBucket", {
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    encryption: s3.BucketEncryption.S3_MANAGED,
    enforceSSL: true,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
    autoDeleteObjects: true,
  });

  return { uploads, outputs, site };
}
