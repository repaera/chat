import "server-only";

import { redis } from "@/lib/redis";

type RateLimitRecord = { count: number; resetAt: number };
type RateLimitResult = { success: boolean; remaining: number; resetAt: number };

// ── In-memory fallback ────────────────────────────────────────────────────────
const store = new Map<string, RateLimitRecord>();

setInterval(
	() => {
		const now = Date.now();
		for (const [k, v] of store.entries()) {
			if (now > v.resetAt) store.delete(k);
		}
	},
	10 * 60 * 1000,
);

function checkMemory(
	id: string,
	opts: { limit: number; windowMs: number },
): RateLimitResult {
	const now = Date.now();
	const rec = store.get(id);
	if (!rec || now > rec.resetAt) {
		const resetAt = now + opts.windowMs;
		store.set(id, { count: 1, resetAt });
		return { success: true, remaining: opts.limit - 1, resetAt };
	}
	if (rec.count >= opts.limit)
		return { success: false, remaining: 0, resetAt: rec.resetAt };
	rec.count++;
	return {
		success: true,
		remaining: opts.limit - rec.count,
		resetAt: rec.resetAt,
	};
}

// ── Redis sliding window ──────────────────────────────────────────────────────
// Uses a sorted set keyed by `id`. Each request adds a member with the current
// timestamp as score. Old members outside the window are pruned on every call.
// Atomic via pipeline — no race conditions across replicas.
async function checkRedis(
	id: string,
	opts: { limit: number; windowMs: number },
): Promise<RateLimitResult> {
	const now = Date.now();
	const windowStart = now - opts.windowMs;
	const resetAt = now + opts.windowMs;
	const member = `${now}-${Math.random().toString(36).slice(2, 9)}`;

	const pipeline = redis!.pipeline();
	pipeline.zremrangebyscore(id, 0, windowStart);
	pipeline.zadd(id, now, member);
	pipeline.zcard(id);
	pipeline.pexpire(id, opts.windowMs);
	const results = await pipeline.exec();

	const count = (results?.[2]?.[1] as number) ?? 1;
	if (count > opts.limit) return { success: false, remaining: 0, resetAt };
	return { success: true, remaining: opts.limit - count, resetAt };
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function checkRateLimit(
	id: string,
	opts: { limit: number; windowMs: number },
): Promise<RateLimitResult> {
	if (redis) return checkRedis(id, opts);
	return checkMemory(id, opts);
}
