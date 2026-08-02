import { beforeEach, describe, expect, it } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

process.env.UPLOADS_BUCKET = "test-uploads-bucket";
process.env.OUTPUTS_BUCKET = "test-outputs-bucket";
process.env.MAX_AGE_MS = String(60 * 60 * 1000);

import { handler } from "./handler";

const s3Mock = mockClient(S3Client);

beforeEach(() => {
  s3Mock.reset();
});

describe("cleanup handler", () => {
  it("deletes objects older than the max age from both buckets", async () => {
    const stale = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const fresh = new Date();

    // Keyed by call order, not by input.Bucket: the S3 client's
    // virtual-hosted-style build step consumes and clears Bucket from the
    // command's own .input before aws-sdk-client-mock's interception
    // point, so matching on it is unreliable. sweepBucket(uploads) and
    // sweepBucket(outputs) each run synchronously up to their own first
    // await before Promise.all does anything else, so their first
    // ListObjectsV2Command calls land in that same left-to-right order.
    s3Mock
      .on(ListObjectsV2Command)
      .resolvesOnce({ Contents: [{ Key: "uploads/stale-job", LastModified: stale }], IsTruncated: false })
      .resolvesOnce({
        Contents: [
          { Key: "r/stale-job/480.webp", LastModified: stale },
          { Key: "r/fresh-job/480.webp", LastModified: fresh },
        ],
        IsTruncated: false,
      });

    await handler();

    const deletedKeySets = s3Mock
      .commandCalls(DeleteObjectsCommand)
      .map((call) => call.args[0].input.Delete?.Objects?.map((o) => o.Key));

    expect(deletedKeySets).toEqual(expect.arrayContaining([["uploads/stale-job"], ["r/stale-job/480.webp"]]));
  });

  it("skips DeleteObjects entirely when a bucket has nothing stale", async () => {
    s3Mock.on(ListObjectsV2Command).resolves({ Contents: [{ Key: "fresh", LastModified: new Date() }], IsTruncated: false });

    await handler();

    expect(s3Mock.commandCalls(DeleteObjectsCommand)).toHaveLength(0);
  });

  it("paginates through ListObjectsV2 until IsTruncated is false", async () => {
    const stale = new Date(Date.now() - 2 * 60 * 60 * 1000);

    s3Mock
      .on(ListObjectsV2Command)
      .resolvesOnce({ Contents: [{ Key: "page-1", LastModified: stale }], IsTruncated: true, NextContinuationToken: "next" })
      .resolves({ Contents: [{ Key: "page-2", LastModified: stale }], IsTruncated: false });

    await handler();

    const deletedKeys = s3Mock
      .commandCalls(DeleteObjectsCommand)
      .flatMap((call) => call.args[0].input.Delete?.Objects?.map((o) => o.Key) ?? []);
    expect(deletedKeys).toEqual(expect.arrayContaining(["page-1", "page-2"]));
  });
});
