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
 *
 * Resizes once per width (not once per width-format pair, which would
 * decode+resize twice for no reason), then encodes both formats from that
 * one resized buffer. All 3 widths and both formats run fully concurrently
 * — 6 operations in flight at once. That's deliberately paired with a
 * Lambda memory size high enough to give this real CPU headroom (see
 * infra/lib/constructs/process-lambda.ts) rather than throttling
 * concurrency down to fit a smaller allocation.
 */
export async function generateVariants(input: Buffer, jobId: string): Promise<GeneratedVariant[]> {
  const source = sharp(input, { failOn: "none" });
  const variantsByWidth = await Promise.all(
    VARIANT_WIDTHS.map(async (targetWidth) => {
      const resized = source.clone().resize({ width: targetWidth, withoutEnlargement: true });

      return Promise.all(
        VARIANT_FORMATS.map(async (format) => {
          // Quality/effort mirror sharp's own upstream defaults, chosen
          // there specifically to balance encode speed against output
          // size — no reason to deviate for a "processes in seconds" demo.
          // 4:2:0 chroma subsampling is an explicit ~30-40% size win on
          // photographic content with no visible loss.
          const encoded =
            format === "webp"
              ? await resized.clone().webp({ quality: 80 }).toBuffer({ resolveWithObject: true })
              : await resized
                  .clone()
                  .avif({ quality: 50, effort: 4, chromaSubsampling: "4:2:0" })
                  .toBuffer({ resolveWithObject: true });

          const variant: GeneratedVariant = {
            targetWidth,
            format,
            contentType: CONTENT_TYPE[format],
            width: encoded.info.width,
            height: encoded.info.height,
            bytes: encoded.info.size,
            body: encoded.data,
            key: variantKey(jobId, targetWidth, format),
          };
          return variant;
        }),
      );
    }),
  );

  return variantsByWidth.flat();
}
