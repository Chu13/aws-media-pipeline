import { beforeAll, describe, expect, it } from "vitest";
import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { MediaPipelineStack } from "../lib/media-pipeline-stack";

// Synthesized once and shared across every assertion below, not once per
// test: the process Lambda's NodejsFunction bundles with Docker (for
// sharp's native bindings) at synth time, and re-running that per `it()`
// turns a several-second op into several minutes for the whole file.
let template: Template;

beforeAll(() => {
  const app = new cdk.App();
  const stack = new MediaPipelineStack(app, "TestStack", {
    env: { account: "123456789012", region: "us-east-1" },
  });
  template = Template.fromStack(stack);
}, 300_000);

describe("MediaPipelineStack", () => {
  it("gives both the uploads and outputs buckets a 1-day lifecycle backstop", () => {
    // S3 Lifecycle expiration only supports whole-day granularity — this
    // asserts the declarative backstop exists, not the real ~60-minute
    // deletion (that's the EventBridge-scheduled sweeper Lambda).
    template.resourceCountIs("AWS::S3::Bucket", 3);
    const buckets = template.findResources("AWS::S3::Bucket", {
      Properties: {
        LifecycleConfiguration: {
          Rules: Match.arrayWith([Match.objectLike({ ExpirationInDays: 1, Status: "Enabled" })]),
        },
      },
    });
    expect(Object.keys(buckets)).toHaveLength(2); // uploads + outputs, not the site bucket
  });

  it("blocks public access on every bucket", () => {
    template.allResourcesProperties("AWS::S3::Bucket", {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  it("runs the rate-limit table on-demand with a TTL attribute", () => {
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      BillingMode: "PAY_PER_REQUEST",
      TimeToLiveSpecification: { AttributeName: "expiresAt", Enabled: true },
    });
  });

  it("schedules the cleanup sweeper to run every 10 minutes", () => {
    template.hasResourceProperties("AWS::Events::Rule", {
      ScheduleExpression: "rate(10 minutes)",
      State: "ENABLED",
    });
  });

  it("never sets X-Frame-Options on the response headers policy", () => {
    const policies = template.findResources("AWS::CloudFront::ResponseHeadersPolicy");
    for (const policy of Object.values(policies)) {
      const behavior = (policy as { Properties: { ResponseHeadersPolicyConfig: { SecurityHeadersConfig?: Record<string, unknown> } } })
        .Properties.ResponseHeadersPolicyConfig.SecurityHeadersConfig;
      expect(behavior?.FrameOptions).toBeUndefined();
    }
  });

  it("sets a frame-ancestors CSP allowing the portfolio site to embed the demo", () => {
    template.hasResourceProperties("AWS::CloudFront::ResponseHeadersPolicy", {
      ResponseHeadersPolicyConfig: {
        SecurityHeadersConfig: {
          ContentSecurityPolicy: {
            ContentSecurityPolicy: Match.stringLikeRegexp("frame-ancestors.*jabordones\\.com"),
          },
        },
      },
    });
  });

  it("caches 403/404 responses for zero seconds so manifest polling never gets stuck", () => {
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: {
        CustomErrorResponses: Match.arrayWith([
          Match.objectLike({ ErrorCode: 403, ErrorCachingMinTTL: 0 }),
          Match.objectLike({ ErrorCode: 404, ErrorCachingMinTTL: 0 }),
        ]),
      },
    });
  });

  it("serves index.html for the site bucket's root path", () => {
    // Without this, a request for "/" asks S3 for the empty-string object
    // key, which doesn't exist — caught by an actual deploy, not synth.
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({ DefaultRootObject: "index.html" }),
    });
  });

  it("grants CloudFront both invocation permissions the presign Function URL needs", () => {
    const permissions = Object.values(template.findResources("AWS::Lambda::Permission")).map(
      (resource) => (resource as { Properties: { Action: string; Principal: string } }).Properties,
    );
    const cloudfrontActions = permissions
      .filter((p) => p.Principal === "cloudfront.amazonaws.com")
      .map((p) => p.Action);

    expect(cloudfrontActions).toEqual(expect.arrayContaining(["lambda:InvokeFunctionUrl", "lambda:InvokeFunction"]));
  });

  it("scopes the presign Lambda's DynamoDB grant to UpdateItem only, not full write access", () => {
    const policies = Object.values(template.findResources("AWS::IAM::Policy")).map(
      (resource) => JSON.stringify((resource as { Properties: { PolicyDocument: unknown } }).Properties.PolicyDocument),
    );
    const dynamoStatements = policies.filter((doc) => doc.includes("dynamodb:"));

    for (const doc of dynamoStatements) {
      expect(doc).not.toContain("dynamodb:PutItem");
      expect(doc).not.toContain("dynamodb:DeleteItem");
    }
  });
});
