import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export interface DistributionProps {
  siteBucket: s3.Bucket;
  outputsBucket: s3.Bucket;
  presignFn: lambda.IFunction;
  presignFnUrl: lambda.FunctionUrl;
}

/**
 * A single distribution fronts everything, so the app is same-origin end
 * to end and the presign API needs no CORS of its own:
 *   /*             -> site bucket (the Vite build)
 *   /r/*\/manifest.json -> outputs bucket, never cached (polling target)
 *   /r/*           -> outputs bucket, cacheable (immutable once written)
 *   /api/*         -> presign Lambda Function URL, never cached
 */
export function createDistribution(scope: Construct, props: DistributionProps): cloudfront.Distribution {
  // Bespoke policy, not a CloudFront managed "security headers" preset —
  // those bake in X-Frame-Options: DENY, which would silently break the
  // portfolio site's iframe embed no matter what CSP says. frameOptions
  // is intentionally left unset below.
  const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(scope, "SecurityHeaders", {
    securityHeadersBehavior: {
      contentSecurityPolicy: {
        contentSecurityPolicy: "frame-ancestors 'self' https://www.jabordones.com https://jabordones.com",
        override: true,
      },
      contentTypeOptions: { override: true },
      referrerPolicy: {
        referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
        override: true,
      },
      strictTransportSecurity: {
        accessControlMaxAge: cdk.Duration.days(365),
        includeSubdomains: true,
        override: true,
      },
    },
  });

  // Every request needs a fresh answer: the rate-limit outcome (/api/*)
  // and the manifest's processing/ready/error status (/r/*/manifest.json)
  // both change request to request.
  const dynamicCachePolicy = new cloudfront.CachePolicy(scope, "DynamicCachePolicy", {
    minTtl: cdk.Duration.seconds(0),
    defaultTtl: cdk.Duration.seconds(0),
    maxTtl: cdk.Duration.seconds(1),
    enableAcceptEncodingBrotli: true,
    enableAcceptEncodingGzip: true,
  });

  // /api/* carries its whole request as a query string (see
  // lambdas/presign/src/validate.ts for why) plus the forwarded viewer-IP
  // header rate limiting depends on.
  const apiOriginRequestPolicy = new cloudfront.OriginRequestPolicy(scope, "ApiOriginRequestPolicy", {
    queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
    headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList("CloudFront-Viewer-Address"),
  });

  const distribution = new cloudfront.Distribution(scope, "Distribution", {
    priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
    // Without this, a request for "/" asks the S3 origin for the
    // empty-string object key, which doesn't exist — OAC's restrictive
    // bucket policy then denies it as a 403 rather than a clean 404.
    defaultRootObject: "index.html",
    defaultBehavior: {
      origin: origins.S3BucketOrigin.withOriginAccessControl(props.siteBucket),
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      responseHeadersPolicy,
    },
    additionalBehaviors: {
      "/r/*/manifest.json": {
        origin: origins.S3BucketOrigin.withOriginAccessControl(props.outputsBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: dynamicCachePolicy,
        responseHeadersPolicy,
      },
      "/r/*": {
        origin: origins.S3BucketOrigin.withOriginAccessControl(props.outputsBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy,
      },
      "/api/*": {
        origin: origins.FunctionUrlOrigin.withOriginAccessControl(props.presignFnUrl),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: dynamicCachePolicy,
        originRequestPolicy: apiOriginRequestPolicy,
        responseHeadersPolicy,
      },
    },
    // 404 is on CloudFront's unconditional cached-error list (10s default
    // TTL) regardless of what the origin sends. Without this, manifest
    // polling can get stuck replaying a cached 404 for up to 10s per miss.
    errorResponses: [
      { httpStatus: 403, ttl: cdk.Duration.seconds(0) },
      { httpStatus: 404, ttl: cdk.Duration.seconds(0) },
    ],
  });

  // CDK's FunctionUrlOrigin.withOriginAccessControl auto-grants only
  // lambda:InvokeFunctionUrl. AWS's Lambda Dual Authorization model,
  // enforced from 2026-11-01, also requires lambda:InvokeFunction for the
  // same caller — add both explicitly rather than lean on the L2 default
  // (tracked as a gap in aws/aws-cdk#35872 at the time this was written).
  const cloudfrontPrincipal = new iam.ServicePrincipal("cloudfront.amazonaws.com");
  const distributionArn = cdk.Stack.of(scope).formatArn({
    service: "cloudfront",
    region: "",
    resource: "distribution",
    resourceName: distribution.distributionId,
  });

  props.presignFn.addPermission("AllowCloudFrontInvokeUrl", {
    principal: cloudfrontPrincipal,
    action: "lambda:InvokeFunctionUrl",
    sourceArn: distributionArn,
  });
  props.presignFn.addPermission("AllowCloudFrontInvokeFn", {
    principal: cloudfrontPrincipal,
    action: "lambda:InvokeFunction",
    sourceArn: distributionArn,
  });

  return distribution;
}
