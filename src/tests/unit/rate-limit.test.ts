import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit";

// Each test uses a unique key to avoid sharing state through the module-level Map.
// Fake timers are used so Date.now() advances without real waiting.
// REDIS_URL is not set in tests — the in-memory path is always used.

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the first request and returns correct remaining count", async () => {
    const result = await checkRateLimit("rl:first-request", { limit: 5, windowMs: 60_000 });
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("decrements remaining on each successive request", async () => {
    const opts = { limit: 3, windowMs: 60_000 };
    const key = "rl:decrement";
    await checkRateLimit(key, opts);
    await checkRateLimit(key, opts);
    const result = await checkRateLimit(key, opts);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("blocks when the limit is reached", async () => {
    const opts = { limit: 2, windowMs: 60_000 };
    const key = "rl:block";
    await checkRateLimit(key, opts);
    await checkRateLimit(key, opts);
    const result = await checkRateLimit(key, opts);
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("allows requests again after the window expires", async () => {
    const opts = { limit: 1, windowMs: 60_000 };
    const key = "rl:reset";
    await checkRateLimit(key, opts);
    expect((await checkRateLimit(key, opts)).success).toBe(false);

    vi.advanceTimersByTime(60_001);

    const afterReset = await checkRateLimit(key, opts);
    expect(afterReset.success).toBe(true);
    expect(afterReset.remaining).toBe(0);
  });

  it("tracks different user keys independently", async () => {
    const opts = { limit: 1, windowMs: 60_000 };
    await checkRateLimit("rl:user-a", opts);
    const blockedA = await checkRateLimit("rl:user-a", opts);
    const allowedB = await checkRateLimit("rl:user-b", opts);
    expect(blockedA.success).toBe(false);
    expect(allowedB.success).toBe(true);
  });

  it("returns a resetAt timestamp roughly one window ahead", async () => {
    const windowMs = 60_000;
    const before = Date.now();
    const result = await checkRateLimit("rl:reset-at", { limit: 5, windowMs });
    expect(result.resetAt).toBeGreaterThanOrEqual(before + windowMs);
    expect(result.resetAt).toBeLessThanOrEqual(before + windowMs + 50);
  });

  it("remaining stays 0 once the limit is hit, not negative", async () => {
    const opts = { limit: 1, windowMs: 60_000 };
    const key = "rl:no-negative";
    await checkRateLimit(key, opts);
    const r1 = await checkRateLimit(key, opts);
    const r2 = await checkRateLimit(key, opts);
    expect(r1.remaining).toBe(0);
    expect(r2.remaining).toBe(0);
  });
});
