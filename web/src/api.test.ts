import { describe, expect, it, vi } from "vitest";
import { PollTimeoutError, pollManifest, requestPresign, uploadToS3 } from "./api";
import type { Manifest } from "./api";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe("requestPresign", () => {
  it("builds the query string from the file's name/type/size", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        jobId: "job-1",
        uploadUrl: "https://uploads.example/uploads/job-1",
        expiresInSeconds: 300,
        manifestUrl: "/r/job-1/manifest.json",
        maxSizeBytes: 10_485_760,
      }),
    );

    const file = { name: "my photo.jpg", type: "image/jpeg", size: 5_242_880 };
    const result = await requestPresign(file, fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/presign?fileName=my+photo.jpg&contentType=image%2Fjpeg&sizeBytes=5242880",
    );
    expect(result.jobId).toBe("job-1");
  });

  it("throws with the server's message when the response is not ok", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: "TOO_LARGE", message: "file too big" }, false, 413));
    const file = { name: "photo.jpg", type: "image/jpeg", size: 99_999_999 };

    await expect(requestPresign(file, fetchImpl)).rejects.toThrow("file too big");
  });
});

describe("uploadToS3", () => {
  it("PUTs the file body directly to the presigned URL", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true } as Response);
    const file = new Blob(["fake bytes"]);

    await uploadToS3(file, "https://uploads.example/uploads/job-1", fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith("https://uploads.example/uploads/job-1", {
      method: "PUT",
      body: file,
    });
  });

  it("throws when the upload response is not ok", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response);
    await expect(uploadToS3(new Blob([]), "https://uploads.example/x", fetchImpl)).rejects.toThrow("403");
  });
});

describe("pollManifest", () => {
  const readyManifest: Manifest = {
    jobId: "job-1",
    status: "ready",
    createdAt: "2026-08-02T10:00:00.000Z",
    expiresAt: "2026-08-02T11:00:00.000Z",
    original: { contentType: "image/jpeg", bytes: 5_000_000, width: 4000, height: 3000 },
    variants: [],
    error: null,
  };

  it("returns the manifest as soon as status is ready", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(readyManifest));

    const result = await pollManifest("/r/job-1/manifest.json", { fetchImpl, timeoutMs: 1000, intervalMs: 5 });

    expect(result).toEqual(readyManifest);
  });

  it("returns the manifest (does not throw) once status is error — the caller renders it", async () => {
    const errorManifest: Manifest = { ...readyManifest, status: "error", original: null, error: "bad image" };
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(errorManifest));

    const result = await pollManifest("/r/job-1/manifest.json", { fetchImpl, timeoutMs: 1000, intervalMs: 5 });

    expect(result.status).toBe("error");
  });

  it("keeps polling through 404s and a processing status until ready", async () => {
    const processingManifest: Manifest = { ...readyManifest, status: "processing", original: null };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, false, 404))
      .mockResolvedValueOnce(jsonResponse(processingManifest))
      .mockResolvedValueOnce(jsonResponse(readyManifest));

    const result = await pollManifest("/r/job-1/manifest.json", { fetchImpl, timeoutMs: 1000, intervalMs: 5 });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(result.status).toBe("ready");
  });

  it("throws PollTimeoutError once the deadline passes without a terminal status", async () => {
    const processingManifest: Manifest = { ...readyManifest, status: "processing", original: null };
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(processingManifest));

    await expect(
      pollManifest("/r/job-1/manifest.json", { fetchImpl, timeoutMs: 30, intervalMs: 10 }),
    ).rejects.toThrow(PollTimeoutError);
  });
});
