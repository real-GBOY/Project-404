/**
 * The client's address for rate limiting. With no trusted proxies it is the socket address.
 * Behind N proxies we trust, it is the Nth X-Forwarded-For entry from the RIGHT — each of our
 * proxies appends the address it received from, so entries further left came from the client
 * and can be forged. A missing or short header falls back to the socket address.
 */
export function clientIp(
  socketIp: string,
  forwardedFor: string | string[] | undefined,
  trustedHops: number,
): string {
  if (trustedHops <= 0 || !forwardedFor) return socketIp;
  const header = Array.isArray(forwardedFor) ? forwardedFor.join(",") : forwardedFor;
  const hops = header
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  return hops[hops.length - trustedHops] ?? socketIp;
}
