import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";

/**
 * One item per (ip, fixed window) — see lambdas/presign/src/rateLimit.ts
 * for the windowing logic itself. `expiresAt` is a TTL attribute, so
 * DynamoDB garbage-collects old windows on its own; no cleanup code needed
 * for this table.
 */
export function createRateLimitTable(scope: Construct): dynamodb.Table {
  return new dynamodb.Table(scope, "RateLimitTable", {
    partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    timeToLiveAttribute: "expiresAt",
    removalPolicy: cdk.RemovalPolicy.DESTROY,
  });
}
