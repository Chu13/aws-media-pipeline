import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { extractClientIp } from "./clientIp";
import { checkRateLimit, RATE_LIMIT_WINDOW_MS, type RateLimitStore } from "./rateLimit";
import { MAX_UPLOAD_BYTES, validatePresignRequest } from "./validate";

// A minimal, structural event/response shape rather than the full
// @types/aws-lambda generic Handler type — a Lambda Function URL event
// has all these fields (and more we don't need), so this is a true subset,
// and it keeps the handler trivially callable from tests without
// Context/Callback boilerplate.
export interface PresignEvent {
  queryStringParameters?: Record<string, string | undefined> | null;
  headers?: Record<string, string | undefined> | null;
}

export interface PresignResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

const UPLOADS_BUCKET = process.env.UPLOADS_BUCKET!;
const RATE_LIMIT_TABLE = process.env.RATE_LIMIT_TABLE!;
const PRESIGN_EXPIRY_SECONDS = 300; // 5 minutes — short-lived per the spec's anti-abuse requirement

const s3 = new S3Client({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const dynamoRateLimitStore: RateLimitStore = {
  async incrementAndGet(ip, windowStartMs) {
    const pk = `${ip}#${windowStartMs}`;
    // TTL a couple minutes past the window's own end — plenty of margin
    // for DynamoDB's TTL sweep (which isn't instantaneous) without ever
    // expiring an item a still-active window needs to read.
    const expiresAt = Math.floor((windowStartMs + RATE_LIMIT_WINDOW_MS) / 1000) + 120;

    const result = await ddb.send(
      new UpdateCommand({
        TableName: RATE_LIMIT_TABLE,
        Key: { pk },
        UpdateExpression: "SET #count = if_not_exists(#count, :zero) + :one, expiresAt = :expiresAt",
        ExpressionAttributeNames: { "#count": "count" },
        ExpressionAttributeValues: { ":zero": 0, ":one": 1, ":expiresAt": expiresAt },
        ReturnValues: "UPDATED_NEW",
      }),
    );

    return Number(result.Attributes?.count ?? 0);
  },
};

function jsonResponse(statusCode: number, body: unknown, extraHeaders: Record<string, string> = {}): PresignResponse {
  return {
    statusCode,
    headers: { "content-type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
  };
}

export const handler = async (event: PresignEvent): Promise<PresignResponse> => {
  const validation = validatePresignRequest(event.queryStringParameters ?? {});
  if (!validation.ok) {
    return jsonResponse(validation.status, { error: validation.code, message: validation.message });
  }

  // Behind CloudFront, this Lambda's own network-level source IP is
  // CloudFront's edge, not the visitor's — the real address only exists in
  // this forwarded header. Missing it entirely (e.g. a malformed request)
  // falls back to a shared bucket rather than throwing, so a parsing edge
  // case degrades to "conservatively rate limited," not "presign is down."
  const ip = extractClientIp(event.headers?.["cloudfront-viewer-address"]) ?? "unknown";

  const rateLimit = await checkRateLimit(dynamoRateLimitStore, ip, Date.now());
  if (!rateLimit.allowed) {
    return jsonResponse(
      429,
      { error: "RATE_LIMITED", message: "too many requests, try again shortly", retryAfterSeconds: rateLimit.retryAfterSeconds },
      { "retry-after": String(rateLimit.retryAfterSeconds) },
    );
  }

  const jobId = randomUUID();
  const key = `uploads/${jobId}`;

  // ContentType is deliberately NOT part of the signed command: browsers
  // aren't reliably consistent about what Content-Type header they attach
  // to a raw PUT, and if it were signed, any mismatch fails the upload
  // with a 403 SignatureDoesNotMatch. The process Lambda determines the
  // real format authoritatively by sniffing the downloaded bytes instead.
  const uploadUrl = await getSignedUrl(s3, new PutObjectCommand({ Bucket: UPLOADS_BUCKET, Key: key }), {
    expiresIn: PRESIGN_EXPIRY_SECONDS,
  });

  return jsonResponse(200, {
    jobId,
    uploadUrl,
    expiresInSeconds: PRESIGN_EXPIRY_SECONDS,
    manifestUrl: `/r/${jobId}/manifest.json`,
    maxSizeBytes: MAX_UPLOAD_BYTES,
  });
};
