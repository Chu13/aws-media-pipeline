import { describe, expect, it } from "vitest";
import { buildErrorManifest, buildProcessingManifest, buildReadyManifest, savingsPct } from "./manifest";
import type { GeneratedVariant } from "./variants";

describe("savingsPct", () => {
  it("computes percentage reduction rounded to one decimal place", () => {
    expect(savingsPct(1000, 500)).toBe(50);
    expect(savingsPct(1000, 1)).toBe(99.9);
    expect(savingsPct(1000, 0)).toBe(100);
  });

  it("returns 0 instead of dividing by zero when the original had no bytes", () => {
    expect(savingsPct(0, 500)).toBe(0);
  });
});

function fakeVariant(overrides: Partial<GeneratedVariant>): GeneratedVariant {
  return {
    targetWidth: 480,
    format: "webp",
    contentType: "image/webp",
    width: 480,
    height: 240,
    bytes: 12000,
    body: Buffer.from("fake"),
    key: "r/job-1/480.webp",
    ...overrides,
  };
}

describe("buildReadyManifest", () => {
  const createdAt = new Date("2026-08-02T10:00:00.000Z");
  const original = { contentType: "image/jpeg", bytes: 5_000_000, width: 4000, height: 3000 };

  it("sets expiresAt exactly 60 minutes after createdAt", () => {
    const manifest = buildReadyManifest({ jobId: "job-1", createdAt, original, variants: [] });

    expect(manifest.createdAt).toBe("2026-08-02T10:00:00.000Z");
    expect(manifest.expiresAt).toBe("2026-08-02T11:00:00.000Z");
    expect(manifest.status).toBe("ready");
    expect(manifest.error).toBeNull();
  });

  it("maps each generated variant to a manifest variant with its URL and savings", () => {
    const variant = fakeVariant({ key: "r/job-1/480.webp", bytes: 12_000 });
    const manifest = buildReadyManifest({ jobId: "job-1", createdAt, original, variants: [variant] });

    expect(manifest.variants).toHaveLength(1);
    expect(manifest.variants[0]).toEqual({
      format: "webp",
      width: 480,
      height: 240,
      bytes: 12_000,
      url: "/r/job-1/480.webp",
      savingsPct: savingsPct(original.bytes, 12_000),
    });
  });
});

describe("buildProcessingManifest", () => {
  it("sets status processing with no original, variants, or error yet", () => {
    const createdAt = new Date("2026-08-02T10:00:00.000Z");
    const manifest = buildProcessingManifest({ jobId: "job-1", createdAt });

    expect(manifest.status).toBe("processing");
    expect(manifest.original).toBeNull();
    expect(manifest.variants).toEqual([]);
    expect(manifest.error).toBeNull();
    expect(manifest.expiresAt).toBe("2026-08-02T11:00:00.000Z");
  });
});

describe("buildErrorManifest", () => {
  it("sets status error with no original and no variants", () => {
    const createdAt = new Date("2026-08-02T10:00:00.000Z");
    const manifest = buildErrorManifest({ jobId: "job-1", createdAt, message: "unsupported image" });

    expect(manifest.status).toBe("error");
    expect(manifest.original).toBeNull();
    expect(manifest.variants).toEqual([]);
    expect(manifest.error).toBe("unsupported image");
    expect(manifest.expiresAt).toBe("2026-08-02T11:00:00.000Z");
  });
});
