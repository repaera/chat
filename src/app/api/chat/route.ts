// src/app/api/chat/route.ts

import { formatLocationForLLM, formatCommuteForLLM } from "@/components/chat/location-types";
import { resolveModel } from "@/lib/llm";
import { createMCPClient } from "@ai-sdk/mcp";
import {
  streamText,
  convertToModelMessages,
  pruneMessages,
  createIdGenerator,
  stepCountIs,
  type ToolSet,
  type UIMessage,
  type FileUIPart,
  type ModelMessage,
  isFileUIPart,
  isTextUIPart,
} from "ai";
import * as Sentry from "@sentry/nextjs";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { checkRateLimit } from "@/lib/rate-limit";
import { chatRequestSchema } from "@/lib/schemas";
import { resolveUserLocale } from "@/lib/locale";
import { appConfig } from "@/lib/app-config";
import { deleteFromR2 } from "@/lib/storage";

// ── Helpers ───────────────────────────────────────────────────────────────

function extractImageTags(text: string): { cleanedText: string; imageUrls: string[] } {
  const MD_IMAGE_RE = /!\[[^\]]*\]\((https?:\/\/[^)]+)\)/g;
  const imageUrls: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = MD_IMAGE_RE.exec(text)) !== null) {
    imageUrls.push(match[1].trim());
  }
  const cleanedText = text.replace(MD_IMAGE_RE, "").replace(/\n{3,}/g, "\n\n").trim();
  return { cleanedText, imageUrls };
}

function detectMimeType(url: string): string {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    avif: "image/avif",
  };
  return map[ext] ?? "image/jpeg";
}

export async function POST(req: Request) {
  // ── 1. Verify session ──────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const userId = session.user.id;

  // Resolve locale from user DB — fallback to APP_LOCALE / "en"
  const userRecord = await db.user.findUnique({
    where: { id: userId },
    select: { locale: true },
  });
  const { t } = await resolveUserLocale(userRecord?.locale);

  // ── 2. Rate limit per user (20 messages/minute) ───────────────────
  const userLimit = await checkRateLimit(`user:${userId}`, {
    limit: 20,
    windowMs: 60_000,
  });
  if (!userLimit.success) {
    return Response.json(
      { error: "Too many messages. Please wait a moment." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  // ── 3. Parse & validate body ───────────────────────────────────
  const body = await req.json().catch(() => null);
  if (!body) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Cast to UIMessage[] — Zod inference produces a local type whose structure
  // is identical but not assignable to UIMessage from the "ai" package in TypeScript.
  // The cast is safe because the schema has already validated its shape.
  const messages = parsed.data.messages as unknown as UIMessage[];
  const { conversationId, timezone, currentTime } = parsed.data;

  // ── 3b. Validate image URL if there is an image part ───────────────
  // Only check images from the LAST newly sent user message.
  // Old messages with images are already attached (messageId != null) — skip.
  const lastMsg = messages[messages.length - 1];
  const imageParts = lastMsg?.role === "user"
    ? (lastMsg.parts ?? []).filter(
        (p): p is FileUIPart =>
          isFileUIPart(p) && p.mediaType.startsWith("image/")
      )
    : [];

  // Check if the image from the last message still exists in the DB as an orphan (not expired)
  for (const imgPart of imageParts) {
    const imageRecord = await db.image.findFirst({
      where: { url: imgPart.url, userId: userId, messageId: null },
      select: { id: true },
    });
    if (!imageRecord) {
      return Response.json(
        { error: "Image has expired. Please upload again." },
        { status: 410 }
      );
    }
  }

  // ── 4. Resolve or create conversation ─────────────────────────
  let convId: string;
  let convTitle: string | null = null;

  if (conversationId) {
    const existing = await db.conversation.findFirst({
      where: { id: conversationId, userId: userId },
      select: { id: true, title: true },
    });
    if (!existing) {
      return Response.json({ error: "Conversation not found." }, { status: 404 });
    }
    convId = conversationId;
    convTitle = existing.title;
  } else {
    const newConv = await db.conversation.create({
      data: { id: newId(), userId: userId },
      select: { id: true, title: true },
    });
    convId = newConv.id;
    convTitle = newConv.title;
  }

  // ── 5. Save the latest user message to DB & auto-generate title ──
  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.role === "user") {
    const userText = (lastMessage.parts ?? [])
      .filter(isTextUIPart)
      .map((p) => p.text)
      .join("");

    // Extract custom parts (location, commute) to be saved separately
    const customPartsData = (lastMessage.parts ?? [])
      .filter((p: any) => p.type === "location" || p.type === "commute");

    await db.message.create({
      data: {
        id: lastMessage.id,
        conversationId: convId,
        role: "user",
        content: userText,
        customParts: customPartsData.length > 0
          ? JSON.stringify(customPartsData)
          : null,
      },
    }).catch((err: unknown) => {
      const isPrismaUniqueViolation =
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: unknown }).code === "P2002";
      if (!isPrismaUniqueViolation) throw err;
    });

    if (!convTitle && userText.length > 0) {
      await db.conversation.update({
        where: { id: convId },
        data: { title: userText.slice(0, 80) + (userText.length > 80 ? "…" : "") },
      });
    }
  }

  // ── 6. MCP Clients (optional) ────────────────────────────────
  // Choose ONE endpoint — not both:
  //   MCP_URL      = Agnostic MCP server (Rails, Laravel, Spring, etc.) — tool call only
  //   MCP_APPS_URL = TypeScript ext-apps server — tool call + embedded UI (MCP Apps)
  // Setting both is a misconfiguration and will be rejected at runtime.
  // Chat continues to work without tools if neither is set.

  if (process.env.MCP_URL && process.env.MCP_APPS_URL) {
    return Response.json(
      { error: "Misconfiguration: set either MCP_URL or MCP_APPS_URL, not both." },
      { status: 500 },
    );
  }

  const mcpClients: Awaited<ReturnType<typeof createMCPClient>>[] = [];
  let tools: ToolSet = {};

  // Helper: create MCP client with JWT auth
  async function createAuthenticatedMCPClient(
    url: string,
    userId: string,
    bearerToken?: string,
  ) {
    const headers: Record<string, string> = {};
    if (bearerToken) {
      headers["Authorization"] = `Bearer ${bearerToken}`;
    }
    if (process.env.MCP_JWT_SECRET) {
      const { SignJWT } = await import("jose");
      const jwt = await new SignJWT({ sub: userId })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("30s")
        .sign(new TextEncoder().encode(process.env.MCP_JWT_SECRET));
      headers["X-User-Token"] = jwt;
    }
    return createMCPClient({
      transport: { type: "http", url, headers },
    }).catch((err) => {
      Sentry.captureException(err, { tags: { source: "mcp:connect", url } });
      return null;
    });
  }

  // MCP_URL — agnostic, tool call only (Rails, Laravel, Spring, etc.)
  if (process.env.MCP_URL) {
    const client = await createAuthenticatedMCPClient(
      process.env.MCP_URL,
      userId,
      process.env.MCP_TOKEN,
    );
    if (client) mcpClients.push(client);
  }

  // MCP_APPS_URL — TypeScript ext-apps server, tool call + embedded UI support
  if (process.env.MCP_APPS_URL) {
    const client = await createAuthenticatedMCPClient(
      process.env.MCP_APPS_URL,
      userId,
      process.env.MCP_APPS_TOKEN,
    );
    if (client) mcpClients.push(client);
  }

  // Merge tools from all successfully connected clients
  for (const client of mcpClients) {
    const clientTools = await client.tools().catch(() => ({}));
    tools = { ...tools, ...clientTools };
  }

  // Pre-process: convert custom parts (location/commute) → plain text parts
  // BEFORE convertToModelMessages. AI SDK v6 strips unknown part types silently,
  // so we must normalize first. Only type:"text" and type:"file" survive.
  const contextWindow = parseInt(process.env.LLM_CONTEXT_WINDOW ?? "30", 10);
  const MAX_TOOL_RESULT_CHARS = parseInt(process.env.MAX_TOOL_RESULT_CHARS ?? "3000", 10);
  const messagesForLLM = messages.slice(-contextWindow).map((msg) => {
    const parts = ((msg.parts ?? []) as any[]).map((p: any) => {
      // Issue 3: truncate large tool-invocation results before they reach the LLM
      if (
        p.type === "tool-invocation" &&
        p.state === "result" &&
        typeof p.result === "string" &&
        p.result.length > MAX_TOOL_RESULT_CHARS
      ) {
        return { ...p, result: p.result.slice(0, MAX_TOOL_RESULT_CHARS) + "\n[truncated]" };
      }
      return p;
    });
    const newParts = parts.flatMap((p: any) => {
      if (p.type === "location") {
        return [{ type: "text" as const, text: formatLocationForLLM(p) }];
      }
      if (p.type === "commute") {
        return [{ type: "text" as const, text: formatCommuteForLLM(p) }];
      }
      // Keep only known SDK part types — strip everything else.
      // file parts are only valid on user messages; assistant messages can have
      // LLM-output images attached (from DB) which must not be forwarded to the LLM.
      if (p.type === "text") return [p];
      if (p.type === "file" && msg.role === "user") return [p];
      return [];
    });
    // If all parts were stripped and there was no text, add empty guard
    if (newParts.length === 0) {
      return { ...msg, parts: [{ type: "text" as const, text: "" }] };
    }
    return { ...msg, parts: newParts };
  });

  // convertToModelMessages → UIMessage[] to ModelMessage[]
  const rawModelMessages = await convertToModelMessages(messagesForLLM);

  // Azure providers cannot download R2 URLs directly (timeout) — fetch images on the
  // server and send as base64 Uint8Array. Other providers handle URLs natively.
  const provider = process.env.LLM_PROVIDER ?? "auto";
  const needsImagePrefetch = provider === "azure-openai" || provider === "azure-foundry" ||
    (provider === "auto" && !!process.env.AZURE_OPENAI_API_KEY);

  // Issue 1: only inject [image_url] hint for the last user message — historical
  // images were already processed by the LLM and don't need the hint re-injected.
  const lastUserMsgIdx = rawModelMessages.reduce(
    (acc, _m, i) => (rawModelMessages[i].role === "user" ? i : acc),
    -1,
  );

  const normalizedMessages = await Promise.all(
    rawModelMessages.map(async (m, idx) => {
      if (!Array.isArray(m.content)) return m;
      const isLastUserMsg = idx === lastUserMsgIdx;
      const content: any[] = [];
      for (const part of m.content as any[]) {
        if (
          needsImagePrefetch &&
          part.type === "file" &&
          typeof part.mediaType === "string" &&
          part.mediaType.startsWith("image/") &&
          typeof part.data === "string" &&
          part.data.startsWith("http")
        ) {
          if (isLastUserMsg) {
            content.push({ type: "text", text: `[image_url: ${part.data}]` });
          }
          try {
            const res = await fetch(part.data);
            const buf = await res.arrayBuffer();
            content.push({
              type: "image",
              image: new Uint8Array(buf),
              mediaType: part.mediaType,
            });
          } catch {
            content.push({ type: "image", image: part.data as string });
          }
        } else {
          if (
            isLastUserMsg &&
            part.type === "file" &&
            typeof part.mediaType === "string" &&
            part.mediaType.startsWith("image/") &&
            typeof part.data === "string" &&
            part.data.startsWith("http")
          ) {
            content.push({ type: "text", text: `[image_url: ${part.data}]` });
          }
          content.push(part);
        }
      }
      return { ...m, content };
    })
  ) as ModelMessage[];

  const modelMessages = pruneMessages({
    messages: normalizedMessages,
    reasoning: "before-last-message",
  });

  // ── 7. Stream response ────────────────────────────────────────

  // Issue 4: only include image instructions when the conversation actually has images
  const conversationHasImages =
    imageParts.length > 0 ||
    messages.some((m) =>
      (m.parts ?? []).some(
        (p: any) => p.type === "file" && (p.mediaType as string)?.startsWith("image/"),
      ),
    );

  // Issue 6: only inject currentTime when the message contains time-related keywords —
  // otherwise it changes every minute and prevents Anthropic prompt caching
  const TIME_KEYWORDS = ["time", "now", "today", "when", "date", "hour", "minute", "morning", "afternoon", "evening", "night", "week", "month", "year"];
  const lastUserText = (lastMsg?.parts ?? [])
    .filter(isTextUIPart)
    .map((p) => p.text)
    .join("")
    .toLowerCase();
  const includeCurrentTime = !!currentTime && TIME_KEYWORDS.some((kw) => lastUserText.includes(kw));

  const result = streamText({
    model: resolveModel(),
    maxOutputTokens: process.env.LLM_MAX_OUTPUT_TOKENS
      ? parseInt(process.env.LLM_MAX_OUTPUT_TOKENS, 10)
      : 2048,
    system: [
      t.system.persona(session.user.name ?? "user"),
      ...(appConfig.personaContext ? [`You specialize in: ${appConfig.personaContext}.`] : []),
      t.system.helpWithTools,
      t.system.tone,
      t.system.proactiveTools,
      ...(conversationHasImages ? [
        t.system.imageUrlTag,
        t.system.imageUrlUsage,
        t.system.imageUrlToolHint,
        t.system.analyseImage,
        t.system.imageOutput,
      ] : []),
      ...(timezone ? [t.system.timezone(timezone)] : []),
      ...(includeCurrentTime ? [t.system.currentTime(currentTime as string)] : []),
    ].join("\n"),
    // convertToModelMessages first → UIMessage[] to ModelMessage[]
    // then pruneMessages to strip reasoning parts from old messages —
    // gpt-5-mini (o-series) includes reasoning tokens in the response, if sent back
    // without being stripped the SDK throws an error because the reasoning part needs a text part after it.
    messages: modelMessages,
    tools,
    // maxSteps was removed in v5 — replaced with stopWhen using an explicit condition
    // Docs: https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0
    // LLM_MAX_STEPS: increase for agentic MCP workflows (e.g. polling Replicate predictions).
    // Default 5 is safe for simple tool calls. For media generation polling, use 10-20.
    stopWhen: stepCountIs(
      process.env.LLM_MAX_STEPS ? parseInt(process.env.LLM_MAX_STEPS, 10) : 5
    ),

    // onError: destructure { error } — not the direct error object
    // Docs: https://ai-sdk.dev/docs/ai-sdk-core/generating-text#onerror-callback
    onError: ({ error }) => {
      // Close all MCP clients on error
      for (const client of mcpClients) {
        void client.close().catch((e) =>
          Sentry.captureException(e, { tags: { source: "mcp:close:onError" } })
        );
      }
      // Log a focused summary — avoid JSON.stringify(error) which serializes
      // embedded binary image data (Uint8Array) into massive unreadable blobs.
      const summary = {
        name: error instanceof Error ? error.name : typeof error,
        message: error instanceof Error ? error.message : String(error),
        status: (error as any)?.status ?? (error as any)?.statusCode,
        cause: error instanceof Error && error.cause
          ? String(error.cause)
          : undefined,
        responseBody: (error as any)?.responseBody ?? (error as any)?.body ?? undefined,
      };
      console.error("[chat/onError]", JSON.stringify(summary, null, 2));
      Sentry.captureException(error, {
        tags: { source: "llm", provider: process.env.LLM_PROVIDER ?? "auto" },
        extra: { userId, conversationId: convId },
      });
    },
  });

  // ── 8. Return stream response with persistence in onFinish ──
  // onFinish: save assistant message to DB after the stream finishes.
  // generateMessageId: consistent ID between server and client.
  // Docs: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence
  const responseHeaders = new Headers({
    "X-Conversation-Id": convId,
  });

  return result.toUIMessageStreamResponse({
    headers: responseHeaders,
    originalMessages: messages,
    generateMessageId: createIdGenerator({ prefix: "msg", size: 16 }),

    onFinish: async ({ messages: finishedMessages }) => {
      // Close all MCP clients after the stream finishes
      await Promise.allSettled(
        mcpClients.map((client) =>
          client.close().catch((err) =>
            Sentry.captureException(err, { tags: { source: "mcp:close:onFinish" } })
          )
        )
      );

      // Save only the latest assistant message to DB
      // finishedMessages is the complete UIMessage[] (original + response)
      const assistantMsg = finishedMessages[finishedMessages.length - 1];
      if (!assistantMsg || assistantMsg.role !== "assistant") return;

      // Extract text from parts, then strip [image: url] tags before saving
      const rawAssistantText = (assistantMsg.parts ?? [])
        .filter(isTextUIPart)
        .map((p) => p.text)
        .join("");

      const { cleanedText, imageUrls } = extractImageTags(rawAssistantText);

      try {
        await db.message.create({
          data: {
            id: assistantMsg.id,
            conversationId: convId,
            role: "assistant",
            content: cleanedText,
          },
        });
        await db.conversation.update({
          where: { id: convId },
          data: { updatedAt: new Date() },
        });

        // Attach LLM-output images as Image records on the assistant message
        if (imageUrls.length > 0) {
          await db.image.createMany({
            data: imageUrls.map((url) => ({
              id: newId(),
              url,
              key: url,       // external URL — not an R2 object; DeleteObjects silently ignores missing keys
              sizeBytes: 0,   // unknown for external images
              userId,
              messageId: assistantMsg.id,
              mimeType: detectMimeType(url),
              attachedAt: new Date(),
            })),
          });
        }

        // Attach all images from the last user message to the messageId
        // so they are not considered orphans by the cleanup job
        if (imageParts.length > 0) {
          await db.image.updateMany({
            where: {
              url: { in: imageParts.map((p) => p.url) },
              userId: userId,
              messageId: null,
            },
            data: {
              messageId: lastMsg?.id ?? null,
              attachedAt: new Date(),
            },
          });
        }
      } catch (err) {
        Sentry.captureException(err, { tags: { source: "db:onFinish" } });
      }
    },
  });
}