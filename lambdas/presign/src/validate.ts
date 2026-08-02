// The presign endpoint is a GET with query-string params (not a POST with a
// JSON body) — see clientIp.ts's neighbor, this is the other half of the
// same CloudFront-OAC constraint: signing a Lambda Function URL request
// through OAC requires the client to precompute a body SHA256 for
// POST/PUT, which a browser can't do cleanly. A GET has no body, so this
// sidesteps the problem entirely instead of working around it.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB, inclusive

export const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

export interface RawPresignQuery {
  fileName?: string;
  contentType?: string;
  sizeBytes?: string;
}

export type PresignValidationResult =
  | { ok: true; fileName: string; contentType: AllowedContentType; sizeBytes: number }
  | { ok: false; status: 400 | 413; code: "MISSING_FIELD" | "UNSUPPORTED_TYPE" | "TOO_LARGE"; message: string };

function isAllowedContentType(value: string | undefined): value is AllowedContentType {
  return value !== undefined && (ALLOWED_CONTENT_TYPES as readonly string[]).includes(value);
}

export function validatePresignRequest(query: RawPresignQuery): PresignValidationResult {
  const fileName = query.fileName?.trim();
  if (!fileName) {
    return { ok: false, status: 400, code: "MISSING_FIELD", message: "fileName is required" };
  }

  if (!isAllowedContentType(query.contentType)) {
    return {
      ok: false,
      status: 400,
      code: "UNSUPPORTED_TYPE",
      message: `contentType must be one of: ${ALLOWED_CONTENT_TYPES.join(", ")}`,
    };
  }

  const sizeBytes = query.sizeBytes ? Number(query.sizeBytes) : NaN;
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return { ok: false, status: 400, code: "MISSING_FIELD", message: "sizeBytes must be a positive number" };
  }

  if (sizeBytes > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      status: 413,
      code: "TOO_LARGE",
      message: `sizeBytes exceeds the ${MAX_UPLOAD_BYTES} byte limit`,
    };
  }

  return { ok: true, fileName, contentType: query.contentType, sizeBytes };
}
