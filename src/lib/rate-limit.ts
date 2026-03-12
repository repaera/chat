import "server-only";

type Record = { count: number; resetAt: number };
const store = new Map<string, Record>();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store.entries()) {
    if (now > v.resetAt) store.delete(k);
  }
}, 10 * 60 * 1000);

export function checkRateLimit(
  id: string,
  opts: { limit: number; windowMs: number }
): { success: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const rec = store.get(id);
  if (!rec || now > rec.resetAt) {
    const resetAt = now + opts.windowMs;
    store.set(id, { count: 1, resetAt });
    return { success: true, remaining: opts.limit - 1, resetAt };
  }
  if (rec.count >= opts.limit) return { success: false, remaining: 0, resetAt: rec.resetAt };
  rec.count++;
  return { success: true, remaining: opts.limit - rec.count, resetAt: rec.resetAt };
}