import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { MAX_UPLOAD_BYTES } from "./validate";

process.env.UPLOADS_BUCKET = "test-uploads-bucket";
process.env.RATE_LIMIT_TABLE = "test-rate-limit-table";

// vi.mock calls are hoisted above imports by Vitest's transform, so this
// takes effect before handler.ts (and its import of the real
// s3-request-presigner) ever loads — a plain static import below sees the
// mocked module already in place.
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://uploads-bucket.s3.amazonaws.com/uploads/fake-signed-url"),
}));

import { handler, type PresignEvent } from "./handler";

const ddbMock = mockClient(DynamoDBDocumentClient);

function makeEvent(overrides: Partial<PresignEvent> = {}): PresignEvent {
  return {
    queryStringParameters: { fileName: "photo.jpg", contentType: "image/jpeg", sizeBytes: "5242880" },
    headers: { "cloudfront-viewer-address": "203.0.113.5:41000" },
    ...overrides,
  };
}

beforeEach(() => {
  ddbMock.reset();
  ddbMock.on(UpdateCommand).resolves({ Attributes: { count: 1 } });
});

describe("presign handler", () => {
  it("returns a 200 with a job id, upload url, and manifest url for a valid request", async () => {
    const result = await handler(makeEvent());
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(200);
    expect(body.jobId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.uploadUrl).toContain("fake-signed-url");
    expect(body.manifestUrl).toBe(`/r/${body.jobId}/manifest.json`);
    expect(body.maxSizeBytes).toBe(MAX_UPLOAD_BYTES);
  });

  it("returns 400 when the request fails validation, without calling DynamoDB", async () => {
    const result = await handler(makeEvent({ queryStringParameters: { fileName: "photo.jpg" } }));

    expect(result.statusCode).toBe(400);
    expect(ddbMock.calls()).toHaveLength(0);
  });

  it("returns 429 with a Retry-After header once the caller is rate limited", async () => {
    ddbMock.on(UpdateCommand).resolves({ Attributes: { count: 999 } });

    const result = await handler(makeEvent());

    expect(result.statusCode).toBe(429);
    expect(result.headers["retry-after"]).toBeDefined();
  });

  it("falls back to a shared bucket when CloudFront-Viewer-Address is missing, instead of throwing", async () => {
    const result = await handler(makeEvent({ headers: {} }));
    expect(result.statusCode).toBe(200);
  });
});
