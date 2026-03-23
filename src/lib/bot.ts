// src/lib/bot.ts
// Chat SDK instance. Adapters are initialized only when their ENV tokens are present.
// State: Redis (if REDIS_URL set) or in-memory.

import "server-only";

import { Chat, type Adapter, type Thread, type Message } from "chat";
import { createMemoryState } from "@chat-adapter/state-memory";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { formatLocationForLLM } from "@/components/chat/location-types";
import {
	findOrCreateBotUser,
	findOrCreateConversation,
	createNewBotConversation,
	detectPlatform,
	type BotPlatform,
} from "./bot/user";
import { resolveUserLocale } from "@/lib/locale";
import {
	downloadTelegramImage,
	downloadWhatsAppImage,
	downloadDiscordImage,
	downloadSlackImage,
	type MediaDownload,
} from "./bot/media";
import { handleBotMessage, type ImagePart } from "./bot/llm";

// ── State adapter ──────────────────────────────────────────────────────────────
const state = process.env.REDIS_URL
	? await (async () => {
			const { createRedisState } = await import("@chat-adapter/state-redis");
			return createRedisState({ url: process.env.REDIS_URL });
		})()
	: createMemoryState();

// ── Adapters (conditional) ─────────────────────────────────────────────────────
const adapters: Record<string, Adapter> = {};

if (process.env.TELEGRAM_BOT_TOKEN) {
	const { createTelegramAdapter } = await import("@chat-adapter/telegram");
	adapters.telegram = createTelegramAdapter({ botToken: process.env.TELEGRAM_BOT_TOKEN });
}

if (
	process.env.WHATSAPP_APP_SECRET &&
	process.env.WHATSAPP_PHONE_NUMBER_ID &&
	process.env.WHATSAPP_ACCESS_TOKEN &&
	process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
) {
	const { createWhatsAppAdapter } = await import("@chat-adapter/whatsapp");
	adapters.whatsapp = createWhatsAppAdapter({
		appSecret: process.env.WHATSAPP_APP_SECRET,
		phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
		accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
		verifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
	});
}

if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_SIGNING_SECRET) {
	const { createSlackAdapter } = await import("@chat-adapter/slack");
	adapters.slack = createSlackAdapter({
		botToken: process.env.SLACK_BOT_TOKEN,
		signingSecret: process.env.SLACK_SIGNING_SECRET,
	});
}

if (process.env.TEAMS_APP_ID && process.env.TEAMS_APP_PASSWORD) {
	const { createTeamsAdapter } = await import("@chat-adapter/teams");
	adapters.teams = createTeamsAdapter({
		appId: process.env.TEAMS_APP_ID,
		appPassword: process.env.TEAMS_APP_PASSWORD,
	});
}

if (process.env.GCHAT_SERVICE_ACCOUNT_KEY) {
	const { createGoogleChatAdapter } = await import("@chat-adapter/gchat");
	adapters.gchat = createGoogleChatAdapter({
		credentials: JSON.parse(process.env.GCHAT_SERVICE_ACCOUNT_KEY),
	});
}

if (
	process.env.DISCORD_BOT_TOKEN &&
	process.env.DISCORD_PUBLIC_KEY &&
	process.env.DISCORD_APPLICATION_ID
) {
	const { createDiscordAdapter } = await import("@chat-adapter/discord");
	adapters.discord = createDiscordAdapter({
		botToken: process.env.DISCORD_BOT_TOKEN,
		publicKey: process.env.DISCORD_PUBLIC_KEY,
		applicationId: process.env.DISCORD_APPLICATION_ID,
	});
}

if (
	process.env.GITHUB_APP_ID &&
	process.env.GITHUB_PRIVATE_KEY &&
	process.env.GITHUB_WEBHOOK_SECRET
) {
	const { createGitHubAdapter } = await import("@chat-adapter/github");
	adapters.github = createGitHubAdapter({
		appId: process.env.GITHUB_APP_ID,
		privateKey: process.env.GITHUB_PRIVATE_KEY,
		webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
	});
}

if (process.env.LINEAR_API_KEY && process.env.LINEAR_WEBHOOK_SECRET) {
	const { createLinearAdapter } = await import("@chat-adapter/linear");
	adapters.linear = createLinearAdapter({
		apiKey: process.env.LINEAR_API_KEY,
		webhookSecret: process.env.LINEAR_WEBHOOK_SECRET,
	});
}

// ── Bot instance ───────────────────────────────────────────────────────────────
export const bot =
	Object.keys(adapters).length > 0
		? new Chat({
				userName: process.env.BOT_NAME ?? "assistant",
				adapters,
				state,
				fallbackStreamingPlaceholderText: null,
				onLockConflict: "force", // prevents message drops during long LLM streaming
		  })
		: null;

if (!bot) {
	// Nothing to register — skip event handler setup.
} else {
	// ── Helpers ──────────────────────────────────────────────────────────────────

	async function extractMessageData(
		platform: BotPlatform,
		message: Message,
		userId: string,
	): Promise<{ userText: string; locationText?: string; imageParts: ImagePart[] }> {
		const raw = message.raw as Record<string, unknown>;
		let userText = message.text;
		let locationText: string | undefined;
		const imageParts: ImagePart[] = [];

		if (platform === "telegram") {
			const msg = raw;
			if (msg?.location) {
				const loc = msg.location as { latitude: number; longitude: number; title?: string };
				locationText = formatLocationForLLM({
					type: "location",
					lat: loc.latitude,
					lng: loc.longitude,
					label: loc.title ?? "Shared location",
				});
			}
			const photos = msg?.photo as Array<{ file_id: string }> | undefined;
			if (photos?.length && process.env.TELEGRAM_BOT_TOKEN) {
				const dl = await downloadTelegramImage(
					process.env.TELEGRAM_BOT_TOKEN,
					photos[photos.length - 1].file_id,
					userId,
				);
				if (dl) imageParts.push(dl);
				else userText = `[User sent an image that could not be processed]\n${userText}`;
			}
			const doc = msg?.document as { file_id: string; mime_type?: string } | undefined;
			if (doc?.mime_type?.startsWith("image/") && process.env.TELEGRAM_BOT_TOKEN) {
				const dl = await downloadTelegramImage(
					process.env.TELEGRAM_BOT_TOKEN,
					doc.file_id,
					userId,
				);
				if (dl) imageParts.push(dl);
				else userText = `[User sent an image that could not be processed]\n${userText}`;
			}
		}

		if (platform === "whatsapp") {
			const msg = raw?.message as Record<string, unknown> | undefined;
			if (msg?.type === "location") {
				const loc = msg.location as {
					latitude: number;
					longitude: number;
					name?: string;
					address?: string;
				};
				locationText = formatLocationForLLM({
					type: "location",
					lat: loc.latitude,
					lng: loc.longitude,
					label: loc.name ?? loc.address ?? "Shared location",
				});
			}
			if (msg?.type === "image" && process.env.WHATSAPP_ACCESS_TOKEN) {
				const img = msg.image as { id: string };
				const dl = await downloadWhatsAppImage(
					img.id,
					process.env.WHATSAPP_ACCESS_TOKEN,
					userId,
				);
				if (dl) imageParts.push(dl);
				else userText = `[User sent an image that could not be processed]\n${userText}`;
			}
		}

		if (platform === "discord") {
			const attachments = (
				raw?.attachments as Array<{ url: string; content_type?: string }>
			) ?? [];
			for (const att of attachments) {
				if (att.content_type?.startsWith("image/")) {
					const dl = await downloadDiscordImage(att.url, userId);
					if (dl) imageParts.push(dl);
				}
			}
		}

		if (platform === "slack" && process.env.SLACK_BOT_TOKEN) {
			const files = (
				(raw?.event as Record<string, unknown>)?.files as Array<{
					url_private: string;
					mimetype?: string;
				}>
			) ?? [];
			for (const file of files) {
				if (file.mimetype?.startsWith("image/")) {
					const dl = await downloadSlackImage(
						file.url_private,
						process.env.SLACK_BOT_TOKEN,
						userId,
					);
					if (dl) imageParts.push(dl);
				}
			}
		}

		return { userText, locationText, imageParts };
	}

	async function handleLinkCommand(
		poster: { post: (text: string) => Promise<unknown> },
		text: string,
		platform: BotPlatform,
		platformUserId: string,
	): Promise<boolean> {
		if (!text.startsWith("/link ")) return false;

		const code = text.split(" ")[1]?.trim().toUpperCase();
		if (!code) {
			await poster.post("Usage: /link CODE\nGenerate a code in Settings → Links.");
			return true;
		}

		const verification = await db.verification.findFirst({
			where: { value: code, expiresAt: { gt: new Date() } },
			select: { id: true, identifier: true },
		});

		if (!verification) {
			await poster.post("Invalid or expired code. Generate a new one from Settings → Links.");
			return true;
		}

		const parts = verification.identifier.split(":");
		const verPlatform = parts[1];
		const webUserId = parts.slice(2).join(":");

		if (verPlatform !== platform) {
			await poster.post("This code is for a different platform.");
			return true;
		}

		const existingBotAccount = await db.account.findFirst({
			where: { providerId: platform, accountId: platformUserId },
			select: { userId: true },
		});
		const oldUserId = existingBotAccount?.userId;

		if (existingBotAccount) {
			await db.account.updateMany({
				where: { providerId: platform, accountId: platformUserId },
				data: { userId: webUserId, updatedAt: new Date() },
			});
			if (oldUserId && oldUserId !== webUserId) {
				await db.conversation.updateMany({
					where: { userId: oldUserId },
					data: { userId: webUserId },
				});
				await db.user.delete({ where: { id: oldUserId } }).catch(() => {});
			}
		} else {
			await db.account.create({
				data: {
					id: newId(),
					providerId: platform,
					accountId: platformUserId,
					userId: webUserId,
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			});
		}

		await db.verification.delete({ where: { id: verification.id } }).catch(() => {});
		const linkedUser = await db.user.findUnique({ where: { id: webUserId }, select: { locale: true } });
		const { t: userT } = await resolveUserLocale(linkedUser?.locale);
		await poster.post(userT.bot.linked);
		return true;
	}

	async function processMessage(thread: Thread, message: Message): Promise<void> {
		const raw = message.raw as Record<string, unknown>;
		const platform = detectPlatform(raw);
		const platformUserId = message.author.userId;
		const displayName = message.author.fullName || platform;

		const wasLink = await handleLinkCommand(thread, message.text, platform, platformUserId);
		if (wasLink) return;

		const userId = await findOrCreateBotUser(platform, platformUserId, displayName, raw);

		if (message.text.trim() === "/newchat") {
			await createNewBotConversation(userId, thread.id as string);
			const newchatUser = await db.user.findUnique({ where: { id: userId }, select: { locale: true } });
			const { t: userT } = await resolveUserLocale(newchatUser?.locale);
			await thread.post(userT.bot.newchat);
			return;
		}

		const conversationId = await findOrCreateConversation(userId, thread.id as string);
		const { userText, locationText, imageParts } = await extractMessageData(
			platform,
			message,
			userId,
		);

		await handleBotMessage({
			userId,
			conversationId,
			userText,
			platform,
			imageParts,
			locationText,
			thread,
		});
	}

	// ── Event handlers ───────────────────────────────────────────────────────────

	bot.onDirectMessage(async (thread, message) => {
		await thread.subscribe();
		await processMessage(thread, message);
	});

	bot.onNewMention(async (thread, message) => {
		const raw = message.raw as Record<string, unknown>;
		const platform = detectPlatform(raw);
		if (platform === "telegram" && !process.env.TELEGRAM_GROUPS_ENABLED) return;
		await thread.subscribe();
		await processMessage(thread, message);
	});

	bot.onSubscribedMessage(async (thread, message) => {
		await processMessage(thread, message);
	});

	bot.onSlashCommand(["/link"], async (event) => {
		const raw = event.raw as Record<string, unknown>;
		const platform = detectPlatform(raw);
		const platformUserId = event.user.userId;
		await handleLinkCommand(event.channel, `/link ${event.text}`, platform, platformUserId);
	});

	bot.onSlashCommand(["/newchat"], async (event) => {
		const raw = event.raw as Record<string, unknown>;
		const platform = detectPlatform(raw);
		const platformUserId = event.user.userId;
		const displayName = event.user.fullName || platform;
		const userId = await findOrCreateBotUser(platform, platformUserId, displayName, raw);
		await createNewBotConversation(userId, event.channel.id as string);
		const newchatUser = await db.user.findUnique({ where: { id: userId }, select: { locale: true } });
		const { t: userT } = await resolveUserLocale(newchatUser?.locale);
		await event.channel.post(userT.bot.newchat);
	});
}