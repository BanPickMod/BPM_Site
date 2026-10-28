/**
 * The sender's address for the abuse limit, taken from X-Forwarded-For at the position a trusted proxy wrote it. The LEFT end of
 * that header is whatever the sender typed, so using it lets anyone get a fresh rate-limit bucket with every request. Each
 * proxy in front of the site appends the address it saw, so the entry `hops` places from the right is the first one we can trust.
 * `hops` is the number of proxies in front of the site (Railway's edge alone: 1). With 0 the header is not trusted at all.
 */
export function pickClientIp(header: string | null | undefined, hops: number): string {
  if (hops <= 0) return "unknown";
  const parts = (header ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return "unknown";
  return parts[Math.max(parts.length - hops, 0)];
}
