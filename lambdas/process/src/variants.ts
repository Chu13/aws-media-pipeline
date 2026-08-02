import sharp from "sharp";

// Three size buckets, two modern formats — 6 variants per upload. Widths
// were chosen in the spec (mobile / tablet / desktop-ish breakpoints).
export const VARIANT_WIDTHS = [480, 1024, 1920] as const;
export const VARIANT_FORMATS = ["webp", "avif"] as const;

export type VariantWidth = (typeof VARIANT_WIDTHS)[number];
export type VariantFormat = (typeof VARIANT_FORMATS)[number];

export interface GeneratedVariant {
  /** Target size bucket this variant belongs to (480/1024/1920) — NOT
   *  necessarily the actual pixel width; see `width` for that. */
  targetWidth: VariantWidth;
  format: VariantFormat;
  contentType: string;
  /** Actual encoded pixel dimensions (never larger than the source). */
  width: number;
  height: number;
  bytes: number;
  body: Buffer;
  /** S3 key under the outputs bucket, matching the CloudFront `/r/*` path. */
  key: string;
}

const CONTENT_TYPE: Record<VariantFormat, string> = {
  webp: "image/webp",
  avif: "image/avif",
};

/**
 * Deterministic output key for a given job/size/format. The frontend
 * predicts these same keys right after presign (before processing even
 * starts) so it knows exactly what to poll for.
 */
export function variantKey(jobId: string, width: VariantWidth, format: VariantFormat): string {
  return `r/${jobId}/${width}.${format}`;
}

/**
 * Generate all 6 WebP/AVIF variants for one uploaded image.
 *
 * Never upscales: `withoutEnlargement` means a source smaller than a given
 * target width is re-encoded at its own size rather than stretched. The
 * output key still uses the requested size bucket regardless, so the
 * manifest's URL scheme stays fixed no matter the source's real dimensions.
 */
export async function generateVariants(input: Buffer, jobId: string): Promise<GeneratedVariant[]> {
  const source = sharp(input, { failOn: "none" });
  const variants: GeneratedVariant[] = [];

  for (const targetWidth of VARIANT_WIDTHS) {
    for (const format of VARIANT_FORMATS) {
      const pipeline = source.clone().resize({ width: targetWidth, withoutEnlargement: true });
      const encoded =
        format === "webp"
          ? await pipeline.webp({ quality: 80 }).toBuffer({ resolveWithObject: true })
          : await pipeline.avif({ quality: 60, effort: 4 }).toBuffer({ resolveWithObject: true });

      variants.push({
        targetWidth,
        format,
        contentType: CONTENT_TYPE[format],
        width: encoded.info.width,
        height: encoded.info.height,
        bytes: encoded.info.size,
        body: encoded.data,
        key: variantKey(jobId, targetWidth, format),
      });
    }
  }

  return variants;
}
