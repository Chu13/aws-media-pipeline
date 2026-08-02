import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

/**
 * Level 06 — serverless media pipeline.
 *
 * Resources (S3 buckets, DynamoDB rate-limit table, the three Lambdas,
 * the sharp layer, and the single CloudFront distribution fronting all of
 * it) are added in Task 4. This scaffold exists so `cdk synth`/`cdk deploy`
 * are wired end-to-end from the first commit.
 */
export class MediaPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
  }
}
