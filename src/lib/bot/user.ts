// src/lib/bot/user.ts
// Identity bridge: maps platform user IDs → internal User rows via the Account table.
// Locale detection uses platform-native signals — no API calls.

import "server-only";

import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { COUNTRY_TO_LOCALE, LANG_TO_LOCALE } from "@/lib/locale";

export type BotPlatform =
	| "telegram"
	| "whatsapp"
	| "slack"
	| "teams"
	| "gchat"
	| "discord"
	| "github"
	| "linear";

// Detect locale from platform-native signals.
// Telegram provides language_code on the from object.
// WhatsApp provides phone number with country prefix.
// All others fall back to APP_LOCALE.
export function detectBotLocale(platform: BotPlatform, raw: unknown): string {
	const fallback = (process.env.APP_LOCALE ?? "en").toLowerCase();
	const r = raw as Record<string, unknown>;

	if (platform === "telegram") {
		// raw IS the Telegram message object
		const lc = (r?.from as Record<string, unknown> | undefined)?.language_code as
			| string
			| undefined;
		if (lc) {
			const lang = lc.split("-")[0].toLowerCase();
			return LANG_TO_LOCALE[lang] ?? fallback;
		}
	}

	if (platform === "whatsapp") {
		// raw = { message: inbound, contact, phoneNumberId } — inbound.from is the phone number
		const phone = (r?.message as Record<string, unknown> | undefined)?.from as
			| string
			| undefined;
		if (phone) {
			const digits = phone.replace(/^\+/, "");
			const prefixToCountry: Record<string, string> = {
				"62": "ID",
				"82": "KR",
				"81": "JP",
				"86": "CN",
				"34": "ES",
				"52": "MX",
				"49": "DE",
				"31": "NL",
				"33": "FR",
				"39": "IT",
			};
			const country =
				prefixToCountry[digits.slice(0, 2)] ?? prefixToCountry[digits.slice(0, 1)];
			if (country) return COUNTRY_TO_LOCALE[country] ?? fallback;
		}
	}

	return fallback;
}

// Detect which platform a message came from based on message.raw (not the raw webhook payload).
// Each adapter stores its own parsed message object in message.raw — see adapter source for details.
export function detectPlatform(raw: unknown): BotPlatform {
	const r = raw as Record<string, unknown>;
	// WhatsApp: { message, contact, phoneNumberId }
	if (r?.phoneNumberId !== undefined) return "whatsapp";
	// GitHub: { type: "issue_comment"|"review_comment", comment, repository }
	if (r?.repository !== undefined && r?.comment !== undefined) return "github";
	// Linear: { comment: { issueId, ... } }
	if ((r?.comment as Record<string, unknown>)?.issueId !== undefined) return "linear";
	// GChat: Pub/Sub notification with message.sender
	if ((r?.message as Record<string, unknown>)?.sender !== undefined) return "gchat";
	// Telegram: message object with message_id at top level
	if (typeof r?.message_id === "number") return "telegram";
	// Discord: message data with author.id
	if ((r?.author as Record<string, unknown>)?.id !== undefined) return "discord";
	// Slack: event with ts (Slack timestamp string)
	if (r?.ts !== undefined && r?.type !== undefined) return "slack";
	// Teams: Graph API message with createdDateTime and from.user
	if (r?.createdDateTime !== undefined && (r?.from as Record<string, unknown>)?.user !== undefined)
		return "teams";
	return "telegram";
}

// True when the message came from a group/channel rather than a DM.
export function isGroupMessage(platform: BotPlatform, raw: unknown): boolean {
	const r = raw as Record<string, unknown>;
	if (platform === "telegram") {
		// raw IS the Telegram message object
		const chatType = (r?.chat as Record<string, unknown> | undefined)?.type as
			| string
			| undefined;
		return chatType === "group" || chatType === "supergroup";
	}
	if (platform === "slack") {
		const channelId = ((r?.event as Record<string, unknown>)?.channel as string) ?? "";
		return channelId.startsWith("C");
	}
	if (platform === "discord")
		return !!(r?.d as Record<string, unknown> | undefined)?.guild_id;
	if (platform === "teams")
		return !!(r?.channelData as Record<string, unknown> | undefined)?.channel;
	if (platform === "gchat")
		return (r?.space as Record<string, unknown> | undefined)?.type === "ROOM";
	return false;
}

// Find or create an internal User + Account for a platform user.
// Locale is detected once on creation and stored in user.locale.
export async function findOrCreateBotUser(
	platform: BotPlatform,
	platformUserId: string,
	displayName: string,
	raw: unknown,
): Promise<string> {
	const existing = await db.account.findFirst({
		where: { providerId: platform, accountId: platformUserId },
		select: { userId: true },
	});
	if (existing) return existing.userId;

	const userId = newId();
	const locale = detectBotLocale(platform, raw);

	await db.$transaction([
		db.user.create({
			data: {
				id: userId,
				name: displayName || `${platform} user`,
				email: `${platform}-${platformUserId}@platform.bot`,
				emailVerified: false,
				locale,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		}),
		db.account.create({
			data: {
				id: newId(),
				providerId: platform,
				accountId: platformUserId,
				userId,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		}),
	]);

	return userId;
}

// Find or create a Conversation for a bot user+thread pair.
// BOT_GROUP_CONVERSATION=shared → all users in a group share one conversation.
// BOT_GROUP_CONVERSATION=per-user (default) → each user has their own.
export async function findOrCreateConversation(
	userId: string,
	threadId: string,
): Promise<string> {
	const isShared = process.env.BOT_GROUP_CONVERSATION === "shared";
	const ownerId = isShared ? await findOrCreateGroupUser(threadId) : userId;

	const existing = await db.conversation.findFirst({
		where: { userId: ownerId, title: `bot:${threadId}` },
		select: { id: true },
	});
	if (existing) return existing.id;

	const conv = await db.conversation.create({
		data: { id: newId(), userId: ownerId, title: `bot:${threadId}` },
	});
	return conv.id;
}

// Create a shared synthetic user for a group thread (shared conversation mode).
async function findOrCreateGroupUser(threadId: string): Promise<string> {
	const existing = await db.account.findFirst({
		where: { providerId: "group", accountId: threadId },
		select: { userId: true },
	});
	if (existing) return existing.userId;

	const userId = newId();
	await db.$transaction([
		db.user.create({
			data: {
				id: userId,
				name: `Group ${threadId.slice(-8)}`,
				email: `group-${threadId}@platform.bot`,
				emailVerified: false,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		}),
		db.account.create({
			data: {
				id: newId(),
				providerId: "group",
				accountId: threadId,
				userId,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		}),
	]);
	return userId;
}
