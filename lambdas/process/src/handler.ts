import type { S3Handler } from "aws-lambda";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { buildErrorManifest, buildProcessingManifest, buildReadyManifest } from "./manifest";
import type { Manifest } from "./manifest";
import { generateVariants } from "./variants";

const OUTPUTS_BUCKET = process.env.OUTPUTS_BUCKET!;
const s3 = new S3Client({});

// sharp's own probed format, mapped to the 3 content types this pipeline
// accepts. Anything else (gif, corrupt bytes, a non-image entirely) falls
// through to the error manifest below — this is the *authoritative* check,
// independent of whatever content-type the browser claimed at upload time.
const SHARP_FORMAT_CONTENT_TYPE: Record<string, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const UPLOAD_KEY_PATTERN = /^uploads\/([^/]+)$/;

function jobIdFromUploadKey(key: string): string | null {
  const match = UPLOAD_KEY_PATTERN.exec(key);
  return match ? match[1] : null;
}

async function putManifest(jobId: string, manifest: Manifest): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: OUTPUTS_BUCKET,
      Key: `r/${jobId}/manifest.json`,
      Body: JSON.stringify(manifest),
      ContentType: "application/json",
    }),
  );
}

async function processUpload(bucket: string, key: string): Promise<void> {
  const jobId = jobIdFromUploadKey(key);
  if (!jobId) {
    console.warn(`Skipping object with unrecognized key format: ${key}`);
    return;
  }

  // Written before any image work starts, so the frontend's very first
  // poll already gets a real 200 instead of racing a possibly-cached 404.
  await putManifest(jobId, buildProcessingManifest({ jobId, createdAt: new Date() }));

  try {
    const getResult = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const inputBuffer = Buffer.from(await getResult.Body!.transformToByteArray());

    const metadata = await sharp(inputBuffer, { failOn: "none" }).metadata();
    const contentType = metadata.format ? SHARP_FORMAT_CONTENT_TYPE[metadata.format] : undefined;

    if (!contentType || !metadata.width || !metadata.height) {
      throw new Error(`unsupported or unreadable image format: ${metadata.format ?? "unknown"}`);
    }

    const variants = await generateVariants(inputBuffer, jobId);

    await Promise.all(
      variants.map((variant) =>
        s3.send(
          new PutObjectCommand({
            Bucket: OUTPUTS_BUCKET,
            Key: variant.key,
            Body: variant.body,
            ContentType: variant.contentType,
            // Forces a real download rather than an inline navigation.
            // The portfolio site's iframe sandbox doesn't grant
            // allow-downloads, so a plain <a download> inside it would be
            // silently blocked; Content-Disposition set on the object
            // itself works regardless of how it's linked to, and combined
            // with target="_blank" on the frontend's anchor (see
            // web/src/ui.ts) it works both embedded and standalone.
            ContentDisposition: `attachment; filename="image-${variant.targetWidth}.${variant.format}"`,
          }),
        ),
      ),
    );

    await putManifest(
      jobId,
      buildReadyManifest({
        jobId,
        createdAt: new Date(),
        original: { contentType, bytes: inputBuffer.byteLength, width: metadata.width, height: metadata.height },
        variants,
      }),
    );
  } catch (error) {
    // Guarantees a terminal manifest no matter what breaks — a corrupt
    // upload, an unsupported format, a transient S3 error — so the
    // frontend's poll loop always resolves instead of hanging forever.
    console.error(`Processing failed for job ${jobId}:`, error);
    const message = error instanceof Error ? error.message : "unknown processing error";
    await putManifest(jobId, buildErrorManifest({ jobId, createdAt: new Date(), message }));
  }
}

export const handler: S3Handler = async (event) => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    await processUpload(bucket, key);
  }
};
