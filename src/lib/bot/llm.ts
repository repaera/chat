// src/lib/bot/llm.ts
// Platform-agnostic LLM handler for bot platforms.

import "server-only";

import { createMCPClient } from "@ai-sdk/mcp";
import * as Sentry from "@sentry/nextjs";
import { stepCountIs, streamText, type ToolSet } from "ai";
import type { Thread } from "chat";
import { appConfig } from "@/lib/app-config";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { resolveModel } from "@/lib/llm";
import { resolveUserLocale } from "@/lib/locale";
import { checkRateLimit } from "@/lib/rate-limit";
import type { BotPlatform } from "./user";

export interface ImagePart {
	url: string;
	mediaType: string;
	key: string;
}

export interface BotMessageOptions {
	userId: string;
	conversationId: string;
	userText: string;
	platform: BotPlatform;
	imageParts?: ImagePart[];
	locationText?: string;
	thread: Thread;
}

// ── Helper: fetch R2 image and convert to data URL (for actual vision) ──
async function imageUrlToDataUrl(
	url: string,
	mediaType: string,
): Promise<string> {
	const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
	if (!res.ok) throw new Error(`Failed to fetch image from R2: ${res.status}`);
	const buffer = await res.arrayBuffer();
	const base64 = Buffer.from(buffer).toString("base64");
	return `data:${mediaType};base64,${base64}`;
}

// ── Platform hints ───────────────────────────────────────────────────────────
const PLATFORM_HINTS: Record<BotPlatform, string> = {
	telegram:
		"You are responding via Telegram. Keep responses concise and natural. Use simple Markdown: **bold**, _italic_, `code`.",
	whatsapp:
		"You are responding via WhatsApp. Keep responses concise and natural. Only use *bold* and _italic_.",
	slack: "You are responding via Slack. Keep responses concise and natural.",
	teams:
		"You are responding via Microsoft Teams. Keep responses professional and concise.",
	gchat: "You are responding via Google Chat. Keep responses concise.",
	discord:
		"You are responding via Discord. Keep responses concise and natural.",
	github:
		"You are responding via GitHub. Keep responses focused on the issue context.",
	linear:
		"You are responding via Linear. Keep responses focused on the issue context.",
};

export async function handleBotMessage(opts: BotMessageOptions): Promise<void> {
	const {
		userId,
		conversationId,
		userText,
		platform,
		imageParts = [],
		locationText,
		thread,
	} = opts;

	// ── 1. Rate limit ──────────────────────────────────────────────────────────
	const rateResult = await checkRateLimit(`user:${userId}`, {
		limit: 20,
		windowMs: 60_000,
	});
	if (!rateResult.success) {
		await thread.post("Too many messages. Please wait a moment.");
		return;
	}

	// ── 2. Weekly quota ────────────────────────────────────────────────────────
	const weeklyLimit = process.env.WEEKLY_MESSAGE_LIMIT
		? parseInt(process.env.WEEKLY_MESSAGE_LIMIT, 10)
		: 0;

	if (weeklyLimit > 0) {
		const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
		const weeklyCount = await db.message.count({
			where: {
				role: "user",
				conversation: { userId },
				createdAt: { gte: since },
			},
		});
		if (weeklyCount >= weeklyLimit) {
			await thread.post(
				"Weekly message limit reached. Please try again next week.",
			);
			return;
		}
	}

	// ── 3. Load conversation history – MOST RECENT 15 (fixed!) ─────────────────
	const contextWindow = parseInt(process.env.BOT_CONTEXT_WINDOW ?? "15", 10);
	const recent = await db.message.findMany({
		where: { conversationId },
		orderBy: { createdAt: "desc" }, // ← newest first
		take: contextWindow,
		select: { role: true, content: true },
	});
	const history = recent.reverse(); // now oldest → newest (correct order for LLM)

	// ── 4. Resolve locale + user info ──────────────────────────────────────────
	const userRecord = await db.user.findUnique({
		where: { id: userId },
		select: { locale: true, name: true },
	});
	const { t } = await resolveUserLocale(userRecord?.locale);
	const userName = userRecord?.name ?? "user";

	// ── 5. MCP clients ─────────────────────────────────────────────────────────
	if (process.env.MCP_URL && process.env.MCP_APPS_URL) {
		await thread.post("Server misconfiguration: contact support.");
		return;
	}

	const mcpClients: Awaited<ReturnType<typeof createMCPClient>>[] = [];
	let tools: ToolSet = {};

	async function connectMCP(url: string, bearerToken?: string) {
		const hdrs: Record<string, string> = {};
		if (bearerToken) hdrs["Authorization"] = `Bearer ${bearerToken}`;
		if (process.env.MCP_JWT_SECRET) {
			const { SignJWT } = await import("jose");
			const jwt = await new SignJWT({ sub: userId })
				.setProtectedHeader({ alg: "HS256" })
				.setIssuedAt()
				.setExpirationTime("30s")
				.sign(new TextEncoder().encode(process.env.MCP_JWT_SECRET));
			hdrs["X-User-Token"] = jwt;
		}
		return createMCPClient({
			transport: { type: "http", url, headers: hdrs },
		}).catch((err) => {
			Sentry.captureException(err, {
				tags: { source: "mcp:connect:bot", url },
			});
			return null;
		});
	}

	if (process.env.MCP_URL) {
		const c = await connectMCP(process.env.MCP_URL, process.env.MCP_TOKEN);
		if (c) mcpClients.push(c);
	}
	if (process.env.MCP_APPS_URL) {
		const c = await connectMCP(
			process.env.MCP_APPS_URL,
			process.env.MCP_APPS_TOKEN,
		);
		if (c) mcpClients.push(c);
	}
	for (const c of mcpClients) {
		const ct = await c.tools().catch(() => ({}));
		tools = { ...tools, ...ct };
	}

	// ── 6. Build messages (same as before – real URL + vision) ─────────────────
	const hasImages = imageParts.length > 0;

	type TextPart = { type: "text"; text: string };
	type ImagePartAI = { type: "image"; image: string; mimeType: string };

	const userContentParts: Array<TextPart | ImagePartAI> = [];

	if (locationText) userContentParts.push({ type: "text", text: locationText });

	for (const img of imageParts) {
		try {
			userContentParts.push({ type: "text", text: `[image_url: ${img.url}]` });
			const dataUrl = await imageUrlToDataUrl(img.url, img.mediaType);
			userContentParts.push({
				type: "image",
				image: dataUrl,
				mimeType: img.mediaType,
			});
		} catch (err) {
			console.error("Image fetch for LLM failed", err);
			userContentParts.push({
				type: "text",
				text: `[Image could not be loaded for analysis]`,
			});
		}
	}

	if (userText) userContentParts.push({ type: "text", text: userText });
	if (userContentParts.length === 0)
		userContentParts.push({ type: "text", text: "" });

	const messages = [
		...history.map((m) => ({
			role: m.role as "user" | "assistant",
			content: m.content,
		})),
		{
			role: "user" as const,
			content:
				userContentParts.length === 1 && userContentParts[0].type === "text"
					? userContentParts[0].text
					: userContentParts,
		},
	];

	// ── 7. System prompt (clean + platform-aware) ──────────────────────────────
	const platformContext =
		process.env[`${platform.toUpperCase()}_PERSONA_CONTEXT`];
	const systemPrompt = [
		t.system.persona(userName),
		...(appConfig.personaContext
			? [`You specialize in: ${appConfig.personaContext}.`]
			: []),
		...(platformContext ? [`You specialize in: ${platformContext}.`] : []),
		t.system.helpWithTools,
		t.system.tone,
		t.system.proactiveTools,
		"Always use standard Markdown: **bold**, *italic*, `code`, ```blocks```, lists, links.",
		"Never output raw [image_url: ...] tags. If you want to share the image, use a clean Markdown link.",
		PLATFORM_HINTS[platform],
	].join("\n");

	// ── 8. Persist user message + auto-title BEFORE streaming ─────────────────
	const userMsgId = newId();
	const storedUserContent =
		[locationText, userText].filter(Boolean).join("\n") || "(media)";

	try {
		await db.message.create({
			data: {
				id: userMsgId,
				conversationId,
				role: "user",
				content: storedUserContent,
			},
		});
	} catch (err) {
		console.error("[bot] Failed to save user message:", err);
		Sentry.captureException(err, { tags: { source: "db:bot:user-message" } });
	}

	if (userText.trim()) {
		const conv = await db.conversation.findUnique({
			where: { id: conversationId },
			select: { title: true },
		});
		if (!conv?.title) {
			const autoTitle =
				userText.slice(0, 80) + (userText.length > 80 ? "…" : "");
			await db.conversation
				.update({
					where: { id: conversationId },
					data: { title: autoTitle },
				})
				.catch((err) => {
					console.error("[bot] Failed to auto-title conversation:", err);
				});
		}
	}

	// ── 9. Stream ──────────────────────────────────────────────────────────────
	const result = streamText({
		model: resolveModel(),
		maxOutputTokens: process.env.LLM_MAX_OUTPUT_TOKENS
			? parseInt(process.env.LLM_MAX_OUTPUT_TOKENS, 10)
			: 2048,
		system: systemPrompt,
		messages: messages as any,
		tools,
		stopWhen: stepCountIs(
			process.env.LLM_MAX_STEPS ? parseInt(process.env.LLM_MAX_STEPS, 10) : 5,
		),
		onError: ({ error }) => {
			console.error(
				"[bot] LLM error:",
				error instanceof Error ? error.message : error,
			);
			Sentry.captureException(error, {
				tags: {
					source: "llm:bot",
					provider: process.env.LLM_PROVIDER ?? "auto",
					platform,
				},
				extra: { userId, conversationId },
			});
		},
	});

	try {
		await thread.post(result.fullStream);
	} catch (err) {
		const code = (err as { code?: string }).code;
		if (code === "VALIDATION_ERROR") {
			await thread
				.post("Sorry, I couldn't generate a response. Please try again.")
				.catch(() => {});
		} else {
			// Log but don't rethrow — still persist whatever the LLM generated.
			console.error("[bot] Platform delivery error:", err);
			Sentry.captureException(err, {
				tags: { source: "platform:bot:post", platform },
				extra: { userId, conversationId },
			});
		}
	}

	await Promise.allSettled(
		mcpClients.map((c) =>
			c
				.close()
				.catch((e) =>
					Sentry.captureException(e, { tags: { source: "mcp:close:bot" } }),
				),
		),
	);

	// ── 10. Persist assistant message ──────────────────────────────────────────
	try {
		const assistantText = await result.text;
		const assistantMsgId = newId();

		await db.message.create({
			data: {
				id: assistantMsgId,
				conversationId,
				role: "assistant",
				content: assistantText,
			},
		});

		await db.conversation.update({
			where: { id: conversationId },
			data: {
				updatedAt: new Date(),
				...(hasImages ? { hasImages: true } : {}),
			},
		});

		if (imageParts.length > 0) {
			await db.image.createMany({
				data: imageParts.map((img) => ({
					id: newId(),
					userId,
					key: img.key,
					url: img.url,
					messageId: userMsgId,
					sizeBytes: 0,
					mimeType: img.mediaType,
					attachedAt: new Date(),
				})),
			});
		}
	} catch (err) {
		console.error("[bot] Failed to save assistant message:", err);
		Sentry.captureException(err, {
			tags: { source: "db:bot:assistant-message" },
		});
	}
}
