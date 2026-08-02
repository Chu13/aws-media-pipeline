import { Readable } from "node:stream";
import { beforeEach, describe, expect, it } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { sdkStreamMixin } from "@smithy/util-stream";
import sharp from "sharp";

process.env.OUTPUTS_BUCKET = "test-outputs-bucket";

import { handler } from "./handler";

const s3Mock = mockClient(S3Client);

function s3Event(key: string) {
  return {
    Records: [{ s3: { bucket: { name: "test-uploads-bucket" }, object: { key } } }],
  };
}

function bodyFromBuffer(buffer: Buffer) {
  return sdkStreamMixin(Readable.from(buffer));
}

function manifestPutsFor(jobId: string) {
  return s3Mock
    .commandCalls(PutObjectCommand)
    .filter((call) => call.args[0].input.Key === `r/${jobId}/manifest.json`)
    .map((call) => JSON.parse(call.args[0].input.Body as string));
}

let validImage: Buffer;

beforeEach(async () => {
  s3Mock.reset();
  validImage = await sharp({
    create: { width: 800, height: 400, channels: 3, background: { r: 10, g: 10, b: 200 } },
  })
    .jpeg()
    .toBuffer();
});

describe("process handler", () => {
  it("writes an early processing manifest before doing any image work", async () => {
    s3Mock.on(GetObjectCommand).resolves({ Body: bodyFromBuffer(validImage) });

    await handler(s3Event("uploads/job-1") as never, {} as never, undefined as never);

    const manifests = manifestPutsFor("job-1");
    expect(manifests.length).toBeGreaterThanOrEqual(2);
    expect(manifests[0].status).toBe("processing");
  });

  it("writes a ready manifest with 6 variants and authoritative original metadata", async () => {
    s3Mock.on(GetObjectCommand).resolves({ Body: bodyFromBuffer(validImage) });

    await handler(s3Event("uploads/job-2") as never, {} as never, undefined as never);

    const manifests = manifestPutsFor("job-2");
    const finalManifest = manifests[manifests.length - 1];

    expect(finalManifest.status).toBe("ready");
    expect(finalManifest.variants).toHaveLength(6);
    expect(finalManifest.original).toEqual({
      contentType: "image/jpeg",
      bytes: validImage.byteLength,
      width: 800,
      height: 400,
    });

    const variantPuts = s3Mock
      .commandCalls(PutObjectCommand)
      .filter((call) => call.args[0].input.Key !== "r/job-2/manifest.json");
    expect(variantPuts).toHaveLength(6);
  });

  it("writes an error manifest instead of throwing when the bytes are not a supported image", async () => {
    s3Mock.on(GetObjectCommand).resolves({ Body: bodyFromBuffer(Buffer.from("definitely not an image")) });

    await expect(handler(s3Event("uploads/job-3") as never, {} as never, undefined as never)).resolves.not.toThrow();

    const manifests = manifestPutsFor("job-3");
    const finalManifest = manifests[manifests.length - 1];
    expect(finalManifest.status).toBe("error");
    expect(finalManifest.error).toBeTruthy();
  });

  it("writes an error manifest instead of throwing when S3 GetObject fails", async () => {
    s3Mock.on(GetObjectCommand).rejects(new Error("S3 is unavailable"));

    await expect(handler(s3Event("uploads/job-4") as never, {} as never, undefined as never)).resolves.not.toThrow();

    const manifests = manifestPutsFor("job-4");
    expect(manifests[manifests.length - 1].status).toBe("error");
  });

  it("skips an object whose key doesn't match the expected uploads/{jobId} shape", async () => {
    await handler(s3Event("uploads/nested/weird-key") as never, {} as never, undefined as never);
    expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(0);
  });
});
