import { describe, expect, it } from "vitest";
import { formatBytes, formatSavingsPct } from "./format";

describe("formatBytes", () => {
  it("formats sub-kilobyte sizes as whole bytes", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats kilobyte-range sizes with one decimal", () => {
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("formats megabyte-range sizes with two decimals", () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.00 MB");
  });

  it("treats exactly 1024 as the KB boundary, not still bytes", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });

  it("treats exactly 1024*1024 as the MB boundary, not still KB", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.00 MB");
  });
});

describe("formatSavingsPct", () => {
  it("renders a positive percentage with a % sign", () => {
    expect(formatSavingsPct(92.3)).toBe("92.3%");
  });

  it("renders 0% without a sign or parens", () => {
    expect(formatSavingsPct(0)).toBe("0%");
  });
});
