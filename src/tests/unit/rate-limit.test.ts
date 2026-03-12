import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit";

// Each test uses a unique key to avoid sharing state through the module-level Map.
// Fake timers are used so Date.now() advances without real waiting.

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the first request and returns correct remaining count", () => {
    const result = checkRateLimit("rl:first-request", { limit: 5, windowMs: 60_000 });
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("decrements remaining on each successive request", () => {
    const opts = { limit: 3, windowMs: 60_000 };
    const key = "rl:decrement";
    checkRateLimit(key, opts);
    checkRateLimit(key, opts);
    const result = checkRateLimit(key, opts);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("blocks when the limit is reached", () => {
    const opts = { limit: 2, windowMs: 60_000 };
    const key = "rl:block";
    checkRateLimit(key, opts);
    checkRateLimit(key, opts);
    const result = checkRateLimit(key, opts);
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("allows requests again after the window expires", () => {
    const opts = { limit: 1, windowMs: 60_000 };
    const key = "rl:reset";
    checkRateLimit(key, opts);
    expect(checkRateLimit(key, opts).success).toBe(false);

    vi.advanceTimersByTime(60_001);

    const afterReset = checkRateLimit(key, opts);
    expect(afterReset.success).toBe(true);
    expect(afterReset.remaining).toBe(0);
  });

  it("tracks different user keys independently", () => {
    const opts = { limit: 1, windowMs: 60_000 };
    checkRateLimit("rl:user-a", opts);
    const blockedA = checkRateLimit("rl:user-a", opts);
    const allowedB = checkRateLimit("rl:user-b", opts);
    expect(blockedA.success).toBe(false);
    expect(allowedB.success).toBe(true);
  });

  it("returns a resetAt timestamp roughly one window ahead", () => {
    const windowMs = 60_000;
    const before = Date.now();
    const result = checkRateLimit("rl:reset-at", { limit: 5, windowMs });
    expect(result.resetAt).toBeGreaterThanOrEqual(before + windowMs);
    expect(result.resetAt).toBeLessThanOrEqual(before + windowMs + 50);
  });

  it("remaining stays 0 once the limit is hit, not negative", () => {
    const opts = { limit: 1, windowMs: 60_000 };
    const key = "rl:no-negative";
    checkRateLimit(key, opts);
    const r1 = checkRateLimit(key, opts);
    const r2 = checkRateLimit(key, opts);
    expect(r1.remaining).toBe(0);
    expect(r2.remaining).toBe(0);
  });
});
