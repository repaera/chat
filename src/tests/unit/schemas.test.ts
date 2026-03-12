import { describe, it, expect } from "vitest";
import {
  chatRequestSchema,
  createConversationSchema,
  uploadResponseSchema,
  heartbeatSchema,
} from "@/lib/schemas";

describe("chatRequestSchema", () => {
  it("accepts valid message with text part", () => {
    const result = chatRequestSchema.safeParse({
      messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "halo" }] }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty messages array", () => {
    const result = chatRequestSchema.safeParse({ messages: [] });
    expect(result.success).toBe(false);
  });

  it("rejects message without parts", () => {
    const result = chatRequestSchema.safeParse({
      messages: [{ id: "1", role: "user" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty parts array", () => {
    const result = chatRequestSchema.safeParse({
      messages: [{ id: "1", role: "user", parts: [] }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid conversationId UUID v7", () => {
    const result = chatRequestSchema.safeParse({
      messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "test" }] }],
      conversationId: "01952b4e-2a1f-7b3c-9d4e-5f6a7b8c9d0e",
    });
    expect(result.success).toBe(true);
  });

  it("rejects conversationId that is not a UUID", () => {
    const result = chatRequestSchema.safeParse({
      messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "test" }] }],
      conversationId: "bukan-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("accepts tool part alongside text part", () => {
    const result = chatRequestSchema.safeParse({
      messages: [{
        id: "1",
        role: "assistant",
        parts: [
          { type: "text", text: "Oke, saya cek dulu." },
          { type: "tool-list_todos", state: "output" },
        ],
      }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional id and trigger fields", () => {
    const result = chatRequestSchema.safeParse({
      id: "session-123",
      trigger: "submit-message",
      messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "hi" }] }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects more than 100 messages", () => {
    const messages = Array.from({ length: 101 }, (_, i) => ({
      id: String(i),
      role: "user" as const,
      parts: [{ type: "text" as const, text: "x" }],
    }));
    const result = chatRequestSchema.safeParse({ messages });
    expect(result.success).toBe(false);
  });

  it("accepts optional timezone field", () => {
    const result = chatRequestSchema.safeParse({
      messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "hi" }] }],
      timezone: "Asia/Jakarta",
    });
    expect(result.success).toBe(true);
  });

  it("rejects timezone longer than 64 characters", () => {
    const result = chatRequestSchema.safeParse({
      messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "hi" }] }],
      timezone: "A".repeat(65),
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional currentTime field", () => {
    const result = chatRequestSchema.safeParse({
      messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "hi" }] }],
      currentTime: "14:30",
    });
    expect(result.success).toBe(true);
  });

  it("rejects currentTime longer than 32 characters", () => {
    const result = chatRequestSchema.safeParse({
      messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "hi" }] }],
      currentTime: "A".repeat(33),
    });
    expect(result.success).toBe(false);
  });

  it("accepts file part with valid image URL", () => {
    const result = chatRequestSchema.safeParse({
      messages: [{
        id: "1",
        role: "user",
        parts: [{
          type: "file",
          mediaType: "image/jpeg",
          url: "https://cdn.example.com/image.jpg",
        }],
      }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts unknown part shapes via the passthrough fallback (otherPartSchema)", () => {
    // messagePartSchema ends with z.object({ type: z.string() }).passthrough() as a catch-all
    // for MCP tool parts. A "file" part with an invalid URL therefore falls through to that
    // schema and is accepted — URL validity is enforced server-side by the upload endpoint.
    const result = chatRequestSchema.safeParse({
      messages: [{
        id: "1",
        role: "user",
        parts: [{ type: "file", mediaType: "image/jpeg", url: "not-a-url" }],
      }],
    });
    expect(result.success).toBe(true);
  });
});

describe("createConversationSchema", () => {
  it("accepts payload without title", () => {
    expect(createConversationSchema.safeParse({}).success).toBe(true);
  });

  it("accepts valid title", () => {
    expect(createConversationSchema.safeParse({ title: "Todo today" }).success).toBe(true);
  });

  it("rejects empty title", () => {
    expect(createConversationSchema.safeParse({ title: "" }).success).toBe(false);
  });

  it("rejects title longer than 200 characters", () => {
    expect(createConversationSchema.safeParse({ title: "a".repeat(201) }).success).toBe(false);
  });
});

describe("uploadResponseSchema", () => {
  it("accepts valid upload response", () => {
    const result = uploadResponseSchema.safeParse({
      url: "https://cdn.example.com/image.jpg",
      key: "images/01952b4e.jpg",
      imageId: "01952b4e-2a1f-7b3c-9d4e-5f6a7b8c9d0e",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid URL", () => {
    const result = uploadResponseSchema.safeParse({
      url: "not-a-url",
      key: "images/01952b4e.jpg",
      imageId: "01952b4e-2a1f-7b3c-9d4e-5f6a7b8c9d0e",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing key", () => {
    const result = uploadResponseSchema.safeParse({
      url: "https://cdn.example.com/image.jpg",
      imageId: "01952b4e-2a1f-7b3c-9d4e-5f6a7b8c9d0e",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing imageId", () => {
    const result = uploadResponseSchema.safeParse({
      url: "https://cdn.example.com/image.jpg",
      key: "images/01952b4e.jpg",
    });
    expect(result.success).toBe(false);
  });
});

describe("heartbeatSchema", () => {
  it("accepts valid imageId", () => {
    const result = heartbeatSchema.safeParse({
      imageId: "01952b4e-2a1f-7b3c-9d4e-5f6a7b8c9d0e",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing imageId", () => {
    const result = heartbeatSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
