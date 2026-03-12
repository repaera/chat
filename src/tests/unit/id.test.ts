import { describe, it, expect } from "vitest";
import { newId } from "@/lib/id";

describe("newId", () => {
  it("generates a string UUID v7 format", () => {
    const id = newId();
    // UUID v7: the 13th digit is '7'
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("generates unique IDs", () => {
    const ids = Array.from({ length: 100 }, () => newId());
    expect(new Set(ids).size).toBe(100);
  });

  it("new IDs are always larger than previous IDs (time-ordered)", () => {
    const a = newId();
    const b = newId();
    expect(b > a).toBe(true);
  });

  it("UUID v7 pass validation regex used in route handler", () => {
    const id = newId();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(uuidRegex.test(id)).toBe(true);
  });

  it("UUID v7 accepted by z.string().uuid() in Zod v4 — confirm custom regex is equivalent", () => {
    const { z } = require("zod");
    const id = newId();
    // Zod v4 updated z.string().uuid() to accept all RFC 4122 versions (including v7)
    const resultStrict = z.string().uuid().safeParse(id);
    const resultRegex = z.string().regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    ).safeParse(id);
    expect(resultStrict.success).toBe(true);  // Zod v4 accepts v7
    expect(resultRegex.success).toBe(true);   // custom regex also accepts v7
  });
});
