// src/lib/bot/llm.ts
// Platform-agnostic LLM handler for bot platforms.
// Mirrors /api/chat/route.ts logic but accepts userId instead of a Better Auth session.

import "server-only";

import type { Thread } from "chat";
import { streamText, stepCountIs, type ToolSet } from "ai";
import { createMCPClient } from "@ai-sdk/mcp";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { resolveModel } from "@/lib/llm";
import { resolveUserLocale } from "@/lib/locale";
import { checkRateLimit } from "@/lib/rate-limit";
import { appConfig } from "@/lib/app-config";
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

// Platform-specific markdown formatting hints injected into the system prompt.
const PLATFORM_HINTS: Record<BotPlatform, string> = {
	telegram:
		"You are responding via Telegram. Keep responses concise. Supported markdown: *bold*, _italic_, `code`, ```blocks```.",
	whatsapp:
		"You are responding via WhatsApp. Keep responses concise. Only *bold* and _italic_ are supported. No headers or code blocks.",
	slack: "You are responding via Slack. Supported markdown: *bold*, _italic_, `code`, ```blocks```.",
	teams: "You are responding via Microsoft Teams. Keep responses professional and concise.",
	gchat: "You are responding via Google Chat. Keep responses concise.",
	discord:
		"You are responding via Discord. Supported markdown: **bold**, *italic*, `code`, ```blocks```.",
	github: "You are responding via GitHub. GitHub Flavored Markdown is supported.",
	linear: "You are responding via Linear. Keep responses focused on the issue context.",
};

export async function handleBotMessage(opts: BotMessageOptions): Promise<void> {
	const { userId, conversationId, userText, platform, imageParts = [], locationText, thread } =
		opts;

	// ── 1. Rate limit ──────────────────────────────────────────────────────────
	const rateResult = await checkRateLimit(`user:${userId}`, { limit: 20, windowMs: 60_000 });
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
			where: { role: "user", conversation: { userId }, createdAt: { gte: since } },
		});
		if (weeklyCount >= weeklyLimit) {
			await thread.post("Weekly message limit reached. Please try again next week.");
			return;
		}
	}

	// ── 3. Load conversation history ───────────────────────────────────────────
	const contextWindow = parseInt(process.env.BOT_CONTEXT_WINDOW ?? "15", 10);
	const history = await db.message.findMany({
		where: { conversationId },
		orderBy: { createdAt: "asc" },
		take: contextWindow,
		select: { role: true, content: true },
	});

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
		return createMCPClient({ transport: { type: "http", url, headers: hdrs } }).catch(
			(err) => {
				Sentry.captureException(err, { tags: { source: "mcp:connect:bot", url } });
				return null;
			},
		);
	}

	if (process.env.MCP_URL) {
		const c = await connectMCP(process.env.MCP_URL, process.env.MCP_TOKEN);
		if (c) mcpClients.push(c);
	}
	if (process.env.MCP_APPS_URL) {
		const c = await connectMCP(process.env.MCP_APPS_URL, process.env.MCP_APPS_TOKEN);
		if (c) mcpClients.push(c);
	}
	for (const c of mcpClients) {
		const ct = await c.tools().catch(() => ({}));
		tools = { ...tools, ...ct };
	}

	// ── 6. Build messages ──────────────────────────────────────────────────────
	const hasImages = imageParts.length > 0;

	type TextPart = { type: "text"; text: string };
	type ImagePart2 = { type: "image"; image: string; mimeType: string };
	const userContentParts: Array<TextPart | ImagePart2> = [];

	if (locationText) userContentParts.push({ type: "text", text: locationText });
	for (const img of imageParts) {
		userContentParts.push({ type: "text", text: `[image_url: ${img.url}]` });
		userContentParts.push({ type: "image", image: img.url, mimeType: img.mediaType });
	}
	if (userText) userContentParts.push({ type: "text", text: userText });
	if (userContentParts.length === 0) userContentParts.push({ type: "text", text: "" });

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

	// ── 7. System prompt ───────────────────────────────────────────────────────
	const platformContext = process.env[`${platform.toUpperCase()}_PERSONA_CONTEXT`];
	const systemPrompt = [
		t.system.persona(userName),
		...(appConfig.personaContext ? [`You specialize in: ${appConfig.personaContext}.`] : []),
		...(platformContext ? [`You specialize in: ${platformContext}.`] : []),
		t.system.helpWithTools,
		t.system.tone,
		t.system.proactiveTools,
		...(hasImages
			? [
					t.system.imageUrlTag,
					t.system.imageUrlUsage,
					t.system.imageUrlToolHint,
					t.system.analyseImage,
					t.system.imageOutput,
				]
			: []),
		PLATFORM_HINTS[platform],
	].join("\n");

	// ── 8. Stream ──────────────────────────────────────────────────────────────
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
			for (const c of mcpClients) {
				void c
					.close()
					.catch((e) =>
						Sentry.captureException(e, { tags: { source: "mcp:close:bot:onError" } }),
					);
			}
			Sentry.captureException(error, {
				tags: { source: "llm:bot", provider: process.env.LLM_PROVIDER ?? "auto", platform },
				extra: { userId, conversationId },
			});
		},
	});

	try {
		await thread.post(result.fullStream);
	} catch (err) {
		// Empty stream: LLM produced no text (e.g. vision not supported, API error).
		// Post a fallback so the user knows something went wrong.
		const code = (err as { code?: string }).code;
		if (code === "VALIDATION_ERROR") {
			await thread.post("Sorry, I couldn't generate a response. Please try again.").catch(() => {});
		} else {
			throw err;
		}
	}

	await Promise.allSettled(
		mcpClients.map((c) =>
			c
				.close()
				.catch((e) =>
					Sentry.captureException(e, { tags: { source: "mcp:close:bot:onFinish" } }),
				),
		),
	);

	// ── 9. Persist ─────────────────────────────────────────────────────────────
	try {
		const assistantText = await result.text;
		const userMsgId = newId();
		const assistantMsgId = newId();
		const storedUserContent =
			[locationText, userText].filter(Boolean).join("\n") || "(media)";

		await db.message.createMany({
			data: [
				{ id: userMsgId, conversationId, role: "user", content: storedUserContent },
				{ id: assistantMsgId, conversationId, role: "assistant", content: assistantText },
			],
		});

		await db.conversation.update({
			where: { id: conversationId },
			data: { updatedAt: new Date(), ...(hasImages ? { hasImages: true } : {}) },
		});

		// Attach uploaded images to the user message so cleanup jobs skip them.
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
		Sentry.captureException(err, { tags: { source: "db:bot:persist" } });
	}
}
