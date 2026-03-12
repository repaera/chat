// src/lib/schemas.ts

import { z } from "zod";

// ── UIMessage parts (AI SDK v5) ───────────────────────────────
const textPartSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});

// File part (AI SDK v5 FileUIPart) — used for images via R2 URL
// Shape: { type: "file", mediaType: "image/jpeg", url: "https://..." }
// Docs: FileUIPart in ai/dist/index.d.ts
const filePartSchema = z.object({
  type: z.literal("file"),
  mediaType: z.string(),
  url: z.string().url(),
  filename: z.string().optional(),
});

const otherPartSchema = z.object({ type: z.string() }).passthrough();
const messagePartSchema = z.union([textPartSchema, filePartSchema, otherPartSchema]);

export const uiMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  parts: z.array(messagePartSchema).min(1, "at least 1 part required"),
  createdAt: z.union([z.string(), z.date()]).optional(),
});

// v5: DefaultChatTransport sends { id, messages, trigger, ...body }
export const chatRequestSchema = z.object({
  id: z.string().optional(),
  messages: z
    .array(uiMessageSchema)
    .min(1, "minimum 1 message")
    .max(100, "maximum 100 messages"),
  trigger: z.string().optional(),
  // z.string().uuid() only validates UUID v4 — use generic regex so UUID v7 passes
  conversationId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).optional(),
  timezone: z.string().max(64).optional(),
  currentTime: z.string().max(32).optional(),
});

export const createConversationSchema = z.object({
  title: z.string().min(1).max(200).optional(),
});

// ── Upload schemas ─────────────────────────────────────────────
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export const uploadResponseSchema = z.object({
  url: z.string().url(),
  key: z.string(),
  imageId: z.string(),
});

// Heartbeat — refresh lastSeenAt to prevent orphan cleanup before submit
export const heartbeatSchema = z.object({
  imageId: z.string(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type UIMessageInput = z.infer<typeof uiMessageSchema>;
export type UploadResponse = z.infer<typeof uploadResponseSchema>;
