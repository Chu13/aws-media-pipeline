// Behind CloudFront, a Lambda Function URL's own `sourceIp` is CloudFront's
// edge IP, not the visitor's — rate limiting by IP would be a no-op without
// this. CloudFront forwards the real address (via an OriginRequestPolicy)
// in `CloudFront-Viewer-Address`, formatted as "ip:port" for IPv4 and
// "[ipv6]:port" for IPv6.
const IPV4_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/;

export function extractClientIp(headerValue: string | undefined): string | null {
  if (!headerValue) return null;

  if (headerValue.startsWith("[")) {
    const closingBracket = headerValue.indexOf("]");
    if (closingBracket === -1) return null;
    const ip = headerValue.slice(1, closingBracket);
    return ip.includes(":") ? ip : null;
  }

  const lastColon = headerValue.lastIndexOf(":");
  if (lastColon === -1) return null;

  const ip = headerValue.slice(0, lastColon);
  return IPV4_PATTERN.test(ip) ? ip : null;
}
