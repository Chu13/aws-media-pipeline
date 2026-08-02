export type VariantFormat = "webp" | "avif";

export interface ManifestVariant {
  format: VariantFormat;
  width: number;
  height: number;
  bytes: number;
  url: string;
  savingsPct: number;
}

export interface ManifestOriginal {
  contentType: string;
  bytes: number;
  width: number;
  height: number;
}

export interface Manifest {
  jobId: string;
  status: "processing" | "ready" | "error";
  createdAt: string;
  expiresAt: string;
  original: ManifestOriginal | null;
  variants: ManifestVariant[];
  error: string | null;
}

export interface PresignResponse {
  jobId: string;
  uploadUrl: string;
  expiresInSeconds: number;
  manifestUrl: string;
  maxSizeBytes: number;
}

type FetchLike = typeof fetch;

export interface UploadableFile {
  name: string;
  type: string;
  size: number;
}

/** Everything is same-origin — the app, /api/*, and /r/* all sit behind
 * the one CloudFront distribution — so this is a plain relative path,
 * no base URL to configure. */
export async function requestPresign(file: UploadableFile, fetchImpl: FetchLike = fetch): Promise<PresignResponse> {
  const params = new URLSearchParams({
    fileName: file.name,
    contentType: file.type,
    sizeBytes: String(file.size),
  });

  const res = await fetchImpl(`/api/presign?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: undefined }));
    throw new Error(body.message ?? `presign failed with status ${res.status}`);
  }

  return res.json();
}

/** The file goes straight to S3 with this one PUT — it never touches our
 * own application server. */
export async function uploadToS3(file: Blob, uploadUrl: string, fetchImpl: FetchLike = fetch): Promise<void> {
  const res = await fetchImpl(uploadUrl, { method: "PUT", body: file });
  if (!res.ok) {
    throw new Error(`upload failed with status ${res.status}`);
  }
}

export class PollTimeoutError extends Error {}

export interface PollOptions {
  timeoutMs?: number;
  intervalMs?: number;
  fetchImpl?: FetchLike;
}

/**
 * Polls until the manifest reaches a terminal status (ready or error) —
 * both are returned normally; only a 404 (not yet written) or a
 * status:"processing" body keep the loop going. Throws only if nothing
 * terminal shows up before the deadline, which the caller renders as its
 * own distinct UI state rather than leaving the spinner running forever.
 */
export async function pollManifest(manifestUrl: string, options: PollOptions = {}): Promise<Manifest> {
  const { timeoutMs = 60_000, intervalMs = 1500, fetchImpl = fetch } = options;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const res = await fetchImpl(manifestUrl, { cache: "no-store" });
    if (res.ok) {
      const manifest = (await res.json()) as Manifest;
      if (manifest.status !== "processing") {
        return manifest;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new PollTimeoutError(`manifest not ready after ${timeoutMs}ms`);
}
