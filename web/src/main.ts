import "./style.css";
import { PollTimeoutError, pollManifest, requestPresign, uploadToS3 } from "./api";
import { clearResults, mountApp, renderResults, setStatus } from "./ui";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

const root = document.getElementById("app");
if (!root) {
  throw new Error("missing #app root element");
}

const refs = mountApp(root);

async function handleFile(file: File): Promise<void> {
  clearResults(refs);

  if (!ALLOWED_TYPES.includes(file.type)) {
    setStatus(refs.statusEl, "Unsupported file type. Please use JPEG, PNG, or WebP.");
    return;
  }
  if (file.size > MAX_SIZE_BYTES) {
    setStatus(refs.statusEl, "That file is too large. The limit is 10 MB.");
    return;
  }

  try {
    setStatus(refs.statusEl, "Requesting a secure upload slot...");
    const presign = await requestPresign(file);

    setStatus(refs.statusEl, "Uploading directly to S3...");
    await uploadToS3(file, presign.uploadUrl);

    setStatus(refs.statusEl, "Processing — generating WebP/AVIF variants...");
    const manifest = await pollManifest(presign.manifestUrl);

    if (manifest.status === "error") {
      setStatus(refs.statusEl, `Processing failed: ${manifest.error ?? "unknown error"}.`);
      return;
    }

    setStatus(refs.statusEl, "Done — your optimized variants are below.");
    renderResults(refs, manifest.original?.bytes ?? file.size, manifest.variants);
  } catch (error) {
    if (error instanceof PollTimeoutError) {
      setStatus(refs.statusEl, "This is taking longer than expected. Please try again in a moment.");
    } else {
      setStatus(refs.statusEl, error instanceof Error ? error.message : "Something went wrong.");
    }
  }
}

refs.dropzone.addEventListener("click", (event) => {
  // fileInput.click() below dispatches its own bubbling click event, which
  // would otherwise reach this same listener again — skip it so opening
  // the file dialog can't loop.
  if (event.target === refs.fileInput) return;
  refs.fileInput.click();
});

refs.dropzone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    refs.fileInput.click();
  }
});

refs.dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  refs.dropzone.classList.add("dropzone--active");
});

refs.dropzone.addEventListener("dragleave", () => {
  refs.dropzone.classList.remove("dropzone--active");
});

refs.dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  refs.dropzone.classList.remove("dropzone--active");
  const file = event.dataTransfer?.files?.[0];
  if (file) void handleFile(file);
});

refs.fileInput.addEventListener("change", () => {
  const file = refs.fileInput.files?.[0];
  if (file) void handleFile(file);
});
