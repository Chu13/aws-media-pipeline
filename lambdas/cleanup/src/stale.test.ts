import { describe, expect, it } from "vitest";
import { selectStaleKeys } from "./stale";

const ONE_HOUR_MS = 60 * 60 * 1000;
const now = new Date("2026-08-02T12:00:00.000Z");

describe("selectStaleKeys", () => {
  it("selects only objects strictly older than the max age", () => {
    const objects = [
      { key: "a", lastModified: new Date("2026-08-02T10:00:00.000Z") }, // 2h old — stale
      { key: "b", lastModified: new Date("2026-08-02T11:50:00.000Z") }, // 10min old — fresh
    ];

    expect(selectStaleKeys(objects, now, ONE_HOUR_MS)).toEqual(["a"]);
  });

  it("keeps an object exactly at the boundary (not yet strictly older)", () => {
    const objects = [{ key: "a", lastModified: new Date(now.getTime() - ONE_HOUR_MS) }];
    expect(selectStaleKeys(objects, now, ONE_HOUR_MS)).toEqual([]);
  });

  it("returns an empty array when nothing is stale", () => {
    const objects = [{ key: "a", lastModified: now }];
    expect(selectStaleKeys(objects, now, ONE_HOUR_MS)).toEqual([]);
  });

  it("returns every key when everything is stale", () => {
    const objects = [
      { key: "a", lastModified: new Date("2026-08-02T09:00:00.000Z") },
      { key: "b", lastModified: new Date("2026-08-02T09:30:00.000Z") },
    ];
    expect(selectStaleKeys(objects, now, ONE_HOUR_MS)).toEqual(["a", "b"]);
  });
});
