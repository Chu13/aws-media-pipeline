import { formatBytes, formatSavingsPct } from "./format";
import type { ManifestVariant, VariantFormat } from "./api";

export interface AppRefs {
  dropzone: HTMLDivElement;
  fileInput: HTMLInputElement;
  statusEl: HTMLParagraphElement;
  resultsSection: HTMLElement;
  resultsBody: HTMLTableSectionElement;
}

// ---------------------------------------------------------------------
// Example gallery data
//
// These numbers and files are copied verbatim from a real manifest.json
// produced by the live pipeline (see web/public/examples/). Nothing here
// is invented — the "Example gallery" section below only ever formats
// this fixed record with the same formatBytes/formatSavingsPct helpers
// used for a visitor's own upload.
// ---------------------------------------------------------------------

interface ExampleVariant {
  format: VariantFormat;
  width: number;
  height: number;
  bytes: number;
  savingsPct: number;
  /** Filename under /examples/ if we shipped the actual file, else null. */
  file: string | null;
}

const EXAMPLE_ORIGINAL = {
  bytes: 641_258,
  width: 3000,
  height: 2000,
  label: "JPEG",
  file: "original.jpg",
};

const EXAMPLE_VARIANTS: ExampleVariant[] = [
  { format: "webp", width: 480, height: 320, bytes: 2_326, savingsPct: 99.6, file: "480.webp" },
  { format: "avif", width: 480, height: 320, bytes: 1_425, savingsPct: 99.8, file: "480.avif" },
  { format: "webp", width: 1024, height: 683, bytes: 6_792, savingsPct: 98.9, file: "1024.webp" },
  { format: "avif", width: 1024, height: 683, bytes: 3_400, savingsPct: 99.5, file: "1024.avif" },
  { format: "webp", width: 1920, height: 1280, bytes: 69_256, savingsPct: 89.2, file: "1920.webp" },
  { format: "avif", width: 1920, height: 1280, bytes: 12_403, savingsPct: 98.1, file: "1920.avif" },
];

const EXAMPLE_BEST = EXAMPLE_VARIANTS.reduce((best, v) => (v.savingsPct > best.savingsPct ? v : best));
const EXAMPLE_AFTER = EXAMPLE_VARIANTS.find((v) => v.file === "480.webp")!;

function exampleVariantRow(v: ExampleVariant): string {
  const label = `${v.width}×${v.height} · ${v.format.toUpperCase()}`;
  const savings = `${formatSavingsPct(v.savingsPct)}${v === EXAMPLE_BEST ? " — best" : ""}`;
  const viewCell = v.file
    ? `<td><a href="/examples/${v.file}" target="_blank" rel="noopener">View file</a></td>`
    : `<td class="unavailable">not pictured</td>`;

  return `
    <tr>
      <td>${label}</td>
      <td class="numeric">${formatBytes(EXAMPLE_ORIGINAL.bytes)}</td>
      <td class="numeric">${formatBytes(v.bytes)}</td>
      <td class="savings">${savings}</td>
      ${viewCell}
    </tr>
  `;
}

function renderExampleGallery(): string {
  return `
    <span class="section__eyebrow">Example gallery</span>
    <h2 id="gallery-heading" class="section__heading">Real pipeline output, not a mockup</h2>
    <p class="section__intro">
      Every file and number below came straight out of a real manifest.json this pipeline produced
      &mdash; the same file format the app itself polls while your own upload is processing.
    </p>

    <div class="gallery__note">
      The original here is a ${EXAMPLE_ORIGINAL.width}×${EXAMPLE_ORIGINAL.height} generated scene, not
      a stock photo &mdash; we don't ship third-party images we don't have the rights to. It's built
      with real gradients and grain, not a flat fill, so the pipeline still has genuine work to do.
    </div>

    <div class="showcase">
      <figure class="showcase__tile showcase__tile--before">
        <div class="showcase__label"><span>Original</span><span>${EXAMPLE_ORIGINAL.label}</span></div>
        <div class="showcase__frame">
          <img
            src="/examples/${EXAMPLE_ORIGINAL.file}"
            alt="Full-resolution original: a generated sunset-over-mountains scene, ${EXAMPLE_ORIGINAL.width}×${EXAMPLE_ORIGINAL.height}."
            width="${EXAMPLE_ORIGINAL.width}"
            height="${EXAMPLE_ORIGINAL.height}"
            loading="lazy"
            decoding="async"
          />
        </div>
        <figcaption>
          <span class="showcase__stat numeric">${formatBytes(EXAMPLE_ORIGINAL.bytes)}</span>
          <p class="showcase__meta">${EXAMPLE_ORIGINAL.width}×${EXAMPLE_ORIGINAL.height} · as uploaded</p>
        </figcaption>
      </figure>

      <figure class="showcase__tile showcase__tile--after">
        <div class="showcase__label"><span>Optimized</span><span>${EXAMPLE_AFTER.format.toUpperCase()}</span></div>
        <div class="showcase__frame">
          <img
            src="/examples/${EXAMPLE_AFTER.file}"
            alt="Optimized ${EXAMPLE_AFTER.width}×${EXAMPLE_AFTER.height} WebP preview of the same image."
            width="${EXAMPLE_AFTER.width}"
            height="${EXAMPLE_AFTER.height}"
            loading="lazy"
            decoding="async"
          />
        </div>
        <figcaption>
          <span class="showcase__stat numeric">${formatBytes(EXAMPLE_AFTER.bytes)}</span>
          <p class="showcase__meta">${EXAMPLE_AFTER.width}×${EXAMPLE_AFTER.height} · generated by sharp</p>
          <span class="showcase__badge">${formatSavingsPct(EXAMPLE_AFTER.savingsPct)} smaller</span>
        </figcaption>
      </figure>
    </div>

    <p class="highlight-stat">
      <span class="highlight-stat__number numeric">${formatSavingsPct(EXAMPLE_BEST.savingsPct)} smaller</span>
      <span class="highlight-stat__label">
        at its best: the ${EXAMPLE_BEST.width}×${EXAMPLE_BEST.height} ${EXAMPLE_BEST.format.toUpperCase()}
        variant took this ${formatBytes(EXAMPLE_ORIGINAL.bytes)} original down to
        ${formatBytes(EXAMPLE_BEST.bytes)}.
      </span>
    </p>

    <div class="table-card">
      <div class="table-card__scroll">
        <table>
          <caption>All six variants from this run</caption>
          <thead>
            <tr>
              <th scope="col">Variant</th>
              <th scope="col">Original</th>
              <th scope="col">Optimized</th>
              <th scope="col">Savings</th>
              <th scope="col">File</th>
            </tr>
          </thead>
          <tbody>
            ${EXAMPLE_VARIANTS.map(exampleVariantRow).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function mountApp(root: HTMLElement): AppRefs {
  root.innerHTML = `
    <main class="app">
      <header class="hero">
        <div class="hero__brand">
          <h1 class="visually-hidden">Ember</h1>
          <img src="/logo.svg" alt="" width="520" height="160" />
        </div>
        <p class="hero__tagline">Smaller images. Shorter memory.</p>
        <p class="hero__lede">
          Drop a JPEG, PNG, or WebP and a live AWS pipeline &mdash; S3, Lambda, CloudFront, no app
          server in between &mdash; hands you back six optimized variants in under 30 seconds, then
          deletes all of it, on purpose, within the hour.
        </p>
      </header>

      <section class="upload" aria-labelledby="upload-heading">
        <h2 id="upload-heading" class="visually-hidden">Upload an image</h2>
        <div
          id="dropzone"
          class="dropzone"
          role="button"
          tabindex="0"
          aria-label="Drop an image here, or press Enter to choose a file"
        >
          <p>Drag an image here, or click to choose a file</p>
          <p class="dropzone__hint">JPEG, PNG, or WebP &mdash; up to 10 MB</p>
          <input
            id="file-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="visually-hidden"
            aria-label="Choose an image file"
          />
        </div>
        <p id="status" class="status" role="status" aria-live="polite" data-state="idle">
          Waiting for an image.
        </p>
      </section>

      <section class="how" aria-labelledby="how-heading">
        <span class="section__eyebrow">How it works</span>
        <h2 id="how-heading" class="section__heading">Four steps, no server of ours in the middle</h2>
        <ol class="how__steps">
          <li class="how__step">
            <span class="how__index" aria-hidden="true">1</span>
            <h3>Drop it in</h3>
            <p>
              Drag a JPEG, PNG, or WebP onto the dropzone above, or click it and choose a file the
              normal way. Up to 10&nbsp;MB.
            </p>
          </li>
          <li class="how__step">
            <span class="how__index" aria-hidden="true">2</span>
            <h3>Straight to S3</h3>
            <p>
              Your browser asks for a one-time upload link and PUTs the file directly to S3. No
              server of ours ever sees the bytes in between.
            </p>
          </li>
          <li class="how__step">
            <span class="how__index" aria-hidden="true">3</span>
            <h3>Sharp gets to work</h3>
            <p>
              That upload fires an S3 event that wakes a Lambda running sharp. It renders six
              variants &mdash; 480/1024/1920px wide, WebP and AVIF &mdash; and never upscales past
              what you gave it.
            </p>
          </li>
          <li class="how__step">
            <span class="how__index" aria-hidden="true">4</span>
            <h3>Real numbers, then gone</h3>
            <p>
              You get the before/after byte counts back in 12&ndash;24 seconds. About an hour
              later, the original and every variant it made are deleted &mdash; a real schedule,
              not a promise.
            </p>
          </li>
        </ol>
      </section>

      <section class="gallery" aria-labelledby="gallery-heading">
        ${renderExampleGallery()}
      </section>

      <section id="results" class="results" hidden aria-labelledby="results-heading">
        <h2 id="results-heading" class="section__heading">Your results</h2>
        <div class="table-card">
          <div class="table-card__scroll">
            <table>
              <caption>Generated variants</caption>
              <thead>
                <tr>
                  <th scope="col">Variant</th>
                  <th scope="col">Original</th>
                  <th scope="col">Optimized</th>
                  <th scope="col">Savings</th>
                  <th scope="col">Download</th>
                </tr>
              </thead>
              <tbody id="results-body"></tbody>
            </table>
          </div>
        </div>
      </section>

      <footer class="app__footer">
        <p>
          Nothing here outlives the hour. This file, and every variant we made from it, is deleted
          automatically in about 60 minutes &mdash; a real schedule, not a promise. No account, no
          download you forgot about, nothing left to find later.
        </p>
      </footer>
    </main>
  `;

  return {
    dropzone: root.querySelector<HTMLDivElement>("#dropzone")!,
    fileInput: root.querySelector<HTMLInputElement>("#file-input")!,
    statusEl: root.querySelector<HTMLParagraphElement>("#status")!,
    resultsSection: root.querySelector<HTMLElement>("#results")!,
    resultsBody: root.querySelector<HTMLTableSectionElement>("#results-body")!,
  };
}

export function setStatus(statusEl: HTMLElement, message: string): void {
  statusEl.textContent = message;
}

export function clearResults(refs: Pick<AppRefs, "resultsSection" | "resultsBody">): void {
  refs.resultsSection.hidden = true;
  refs.resultsBody.innerHTML = "";
}

export function renderResults(
  refs: Pick<AppRefs, "resultsSection" | "resultsBody">,
  originalBytes: number,
  variants: ManifestVariant[],
): void {
  refs.resultsSection.hidden = false;
  refs.resultsBody.innerHTML = variants
    .map((variant) => {
      const label = `${variant.width}×${variant.height} · ${variant.format.toUpperCase()}`;
      return `
        <tr>
          <td>${label}</td>
          <td class="numeric">${formatBytes(originalBytes)}</td>
          <td class="numeric">${formatBytes(variant.bytes)}</td>
          <td class="savings">${formatSavingsPct(variant.savingsPct)}</td>
          <td><a href="${variant.url}" target="_blank" rel="noopener">Download</a></td>
        </tr>
      `;
    })
    .join("");
}
