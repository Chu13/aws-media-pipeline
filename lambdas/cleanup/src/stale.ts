export interface S3ObjectSummary {
  key: string;
  lastModified: Date;
}

/**
 * Objects strictly older than `maxAgeMs` are stale. An object exactly at
 * the boundary is kept for one more sweep rather than raced — this
 * sweeper runs every 10 minutes, so the practical window is
 * `maxAgeMs` to `maxAgeMs + 10min`, never less than the promised minimum.
 */
export function selectStaleKeys(objects: S3ObjectSummary[], now: Date, maxAgeMs: number): string[] {
  const cutoff = now.getTime() - maxAgeMs;
  return objects.filter((obj) => obj.lastModified.getTime() < cutoff).map((obj) => obj.key);
}
