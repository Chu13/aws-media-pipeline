import { describe, expect, it } from "vitest";
import { extractClientIp } from "./clientIp";

describe("extractClientIp", () => {
  it("extracts the IPv4 address from CloudFront's IP:port header value", () => {
    expect(extractClientIp("203.0.113.178:37821")).toBe("203.0.113.178");
  });

  it("extracts the IPv6 address from bracketed [addr]:port notation", () => {
    expect(extractClientIp("[2001:db8::1]:58542")).toBe("2001:db8::1");
  });

  it("returns null when the header is missing", () => {
    expect(extractClientIp(undefined)).toBeNull();
  });

  it("returns null when there is no port separator to split on", () => {
    expect(extractClientIp("not-an-ip")).toBeNull();
  });

  it("returns null for an unterminated IPv6 bracket", () => {
    expect(extractClientIp("[2001:db8::1:58542")).toBeNull();
  });
});
