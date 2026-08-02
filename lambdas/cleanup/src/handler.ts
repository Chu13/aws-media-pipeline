import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { selectStaleKeys, type S3ObjectSummary } from "./stale";

const UPLOADS_BUCKET = process.env.UPLOADS_BUCKET!;
const OUTPUTS_BUCKET = process.env.OUTPUTS_BUCKET!;
const MAX_AGE_MS = Number(process.env.MAX_AGE_MS ?? 60 * 60 * 1000);

const s3 = new S3Client({});

async function listAllObjects(bucket: string): Promise<S3ObjectSummary[]> {
  const objects: S3ObjectSummary[] = [];
  let continuationToken: string | undefined;

  do {
    const result = await s3.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: continuationToken }));
    for (const obj of result.Contents ?? []) {
      if (obj.Key && obj.LastModified) {
        objects.push({ key: obj.Key, lastModified: obj.LastModified });
      }
    }
    continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
  } while (continuationToken);

  return objects;
}

async function deleteKeys(bucket: string, keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  // S3's DeleteObjects accepts at most 1000 keys per call.
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000);
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: batch.map((Key) => ({ Key })) },
      }),
    );
  }
}

async function sweepBucket(bucket: string, now: Date): Promise<number> {
  const objects = await listAllObjects(bucket);
  const staleKeys = selectStaleKeys(objects, now, MAX_AGE_MS);
  await deleteKeys(bucket, staleKeys);
  return staleKeys.length;
}

export const handler = async (): Promise<void> => {
  const now = new Date();
  const [uploadsDeleted, outputsDeleted] = await Promise.all([
    sweepBucket(UPLOADS_BUCKET, now),
    sweepBucket(OUTPUTS_BUCKET, now),
  ]);
  console.log(`Cleanup swept ${uploadsDeleted} stale object(s) from uploads, ${outputsDeleted} from outputs`);
};
