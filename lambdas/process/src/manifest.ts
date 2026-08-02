import type { GeneratedVariant, VariantFormat } from "./variants";

const EXPIRATION_MS = 60 * 60 * 1000; // 1 hour — matches the S3 sweeper's window.

export interface ManifestOriginal {
  filename: string;
  contentType: string;
  bytes: number;
  width: number;
  height: number;
}

export interface ManifestVariant {
  format: VariantFormat;
  width: number;
  height: number;
  bytes: number;
  url: string;
  savingsPct: number;
}

export interface Manifest {
  jobId: string;
  status: "ready" | "error";
  createdAt: string;
  expiresAt: string;
  original: ManifestOriginal | null;
  variants: ManifestVariant[];
  error: string | null;
}

/** Percentage byte reduction, rounded to one decimal. Guards against a
 * zero-byte original rather than producing Infinity/NaN. */
export function savingsPct(originalBytes: number, variantBytes: number): number {
  if (originalBytes <= 0) return 0;
  const pct = (1 - variantBytes / originalBytes) * 100;
  return Math.round(pct * 10) / 10;
}

export function buildReadyManifest(params: {
  jobId: string;
  createdAt: Date;
  original: ManifestOriginal;
  variants: GeneratedVariant[];
}): Manifest {
  return {
    jobId: params.jobId,
    status: "ready",
    createdAt: params.createdAt.toISOString(),
    expiresAt: new Date(params.createdAt.getTime() + EXPIRATION_MS).toISOString(),
    original: params.original,
    variants: params.variants.map((variant) => ({
      format: variant.format,
      width: variant.width,
      height: variant.height,
      bytes: variant.bytes,
      url: `/${variant.key}`,
      savingsPct: savingsPct(params.original.bytes, variant.bytes),
    })),
    error: null,
  };
}

export function buildErrorManifest(params: { jobId: string; createdAt: Date; message: string }): Manifest {
  return {
    jobId: params.jobId,
    status: "error",
    createdAt: params.createdAt.toISOString(),
    expiresAt: new Date(params.createdAt.getTime() + EXPIRATION_MS).toISOString(),
    original: null,
    variants: [],
    error: params.message,
  };
}
