export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// The manifest already rounds savingsPct to one decimal server-side
// (see lambdas/process/src/manifest.ts) — this just owns the single
// display format so every call site renders it identically.
export function formatSavingsPct(pct: number): string {
  return `${pct}%`;
}
