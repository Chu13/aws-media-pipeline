import { beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { VARIANT_FORMATS, VARIANT_WIDTHS, generateVariants, variantKey } from "./variants";

// 2:1 aspect ratio, wide enough that all three target widths (480/1024/1920)
// downscale cleanly to whole-number heights (240/512/960) — no rounding fuzz.
let wideImage: Buffer;

// Smaller than every target width, so every variant must hit the
// withoutEnlargement path and keep the source's own pixel size.
let tinyImage: Buffer;

beforeAll(async () => {
  wideImage = await sharp({
    create: { width: 3200, height: 1600, channels: 3, background: { r: 200, g: 30, b: 30 } },
  })
    .png()
    .toBuffer();

  tinyImage = await sharp({
    create: { width: 200, height: 100, channels: 3, background: { r: 10, g: 200, b: 10 } },
  })
    .png()
    .toBuffer();
});

describe("generateVariants", () => {
  it("generates exactly one variant per width/format combination", async () => {
    const variants = await generateVariants(wideImage, "job-1");

    expect(variants).toHaveLength(VARIANT_WIDTHS.length * VARIANT_FORMATS.length);

    const expectedKeys = new Set(
      VARIANT_WIDTHS.flatMap((width) => VARIANT_FORMATS.map((format) => variantKey("job-1", width, format))),
    );
    expect(new Set(variants.map((v) => v.key))).toEqual(expectedKeys);
  });

  it("preserves the source aspect ratio when downscaling", async () => {
    const variants = await generateVariants(wideImage, "job-2");

    for (const width of VARIANT_WIDTHS) {
      const variant = variants.find((v) => v.key === variantKey("job-2", width, "webp"))!;
      expect(variant.width).toBe(width);
      expect(variant.height).toBe(width / 2);
    }
  });

  it("never upscales — a source smaller than the target keeps its own pixel size", async () => {
    const variants = await generateVariants(tinyImage, "job-3");

    for (const variant of variants) {
      expect(variant.width).toBe(200);
      expect(variant.height).toBe(100);
    }

    // The output key still uses the requested size bucket, even though the
    // actual pixels didn't grow — the frontend polls fixed, predictable URLs.
    const expectedKeys = new Set(
      VARIANT_WIDTHS.flatMap((width) => VARIANT_FORMATS.map((format) => variantKey("job-3", width, format))),
    );
    expect(new Set(variants.map((v) => v.key))).toEqual(expectedKeys);
  });

  it("sets the correct content type per format", async () => {
    const variants = await generateVariants(wideImage, "job-4");

    for (const variant of variants) {
      if (variant.key.endsWith(".webp")) {
        expect(variant.contentType).toBe("image/webp");
      } else if (variant.key.endsWith(".avif")) {
        expect(variant.contentType).toBe("image/avif");
      } else {
        throw new Error(`unexpected key: ${variant.key}`);
      }
    }
  });

  it("reports a byte size that matches the actual encoded body", async () => {
    const variants = await generateVariants(wideImage, "job-5");

    for (const variant of variants) {
      expect(variant.bytes).toBeGreaterThan(0);
      expect(variant.bytes).toBe(variant.body.byteLength);
    }
  });
});

describe("variantKey", () => {
  it("builds a deterministic S3 key under the r/ CloudFront path prefix", () => {
    expect(variantKey("abc123", 480, "webp")).toBe("r/abc123/480.webp");
    expect(variantKey("abc123", 1920, "avif")).toBe("r/abc123/1920.avif");
  });
});
