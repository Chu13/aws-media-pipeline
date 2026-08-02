import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, validatePresignRequest } from "./validate";

const validQuery = { fileName: "photo.jpg", contentType: "image/jpeg", sizeBytes: "5242880" };

describe("validatePresignRequest", () => {
  it("accepts a valid request and normalizes the fields", () => {
    const result = validatePresignRequest(validQuery);

    expect(result).toEqual({
      ok: true,
      fileName: "photo.jpg",
      contentType: "image/jpeg",
      sizeBytes: 5_242_880,
    });
  });

  it("trims whitespace from fileName", () => {
    const result = validatePresignRequest({ ...validQuery, fileName: "  photo.jpg  " });
    expect(result).toEqual({ ok: true, fileName: "photo.jpg", contentType: "image/jpeg", sizeBytes: 5_242_880 });
  });

  it("rejects a missing fileName", () => {
    const result = validatePresignRequest({ ...validQuery, fileName: undefined });
    expect(result).toEqual({ ok: false, status: 400, code: "MISSING_FIELD", message: "fileName is required" });
  });

  it("rejects a whitespace-only fileName", () => {
    const result = validatePresignRequest({ ...validQuery, fileName: "   " });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.code).toBe("MISSING_FIELD");
  });

  it("rejects a missing contentType", () => {
    const result = validatePresignRequest({ ...validQuery, contentType: undefined });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.code).toBe("UNSUPPORTED_TYPE");
  });

  it("rejects a disallowed contentType", () => {
    const result = validatePresignRequest({ ...validQuery, contentType: "image/gif" });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.code).toBe("UNSUPPORTED_TYPE");
  });

  it("rejects a missing sizeBytes", () => {
    const result = validatePresignRequest({ ...validQuery, sizeBytes: undefined });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.code).toBe("MISSING_FIELD");
  });

  it("rejects a non-numeric sizeBytes", () => {
    const result = validatePresignRequest({ ...validQuery, sizeBytes: "not-a-number" });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.code).toBe("MISSING_FIELD");
  });

  it("rejects a zero or negative sizeBytes", () => {
    expect(validatePresignRequest({ ...validQuery, sizeBytes: "0" }).ok).toBe(false);
    expect(validatePresignRequest({ ...validQuery, sizeBytes: "-5" }).ok).toBe(false);
  });

  it("accepts exactly the 10MB limit (inclusive boundary)", () => {
    const result = validatePresignRequest({ ...validQuery, sizeBytes: String(MAX_UPLOAD_BYTES) });
    expect(result.ok).toBe(true);
  });

  it("rejects one byte over the 10MB limit", () => {
    const result = validatePresignRequest({ ...validQuery, sizeBytes: String(MAX_UPLOAD_BYTES + 1) });
    expect(result).toEqual({
      ok: false,
      status: 413,
      code: "TOO_LARGE",
      message: `sizeBytes exceeds the ${MAX_UPLOAD_BYTES} byte limit`,
    });
  });
});
