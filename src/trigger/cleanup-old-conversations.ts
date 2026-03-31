// src/trigger/cleanup-old-conversations.ts

import { logger, schedules, task } from "@trigger.dev/sdk/v3";
import { db } from "@/lib/db";
import { deleteManyFromR2, isStorageConfigured } from "@/lib/storage";

const RETENTION_DAYS = 30;

// How long an empty bot conversation (e.g. created by /newchat with no follow-up)
// must sit before it is pruned. 1 hour gives users time to send their first message.
const EMPTY_BOT_CONV_TTL_MS = 60 * 60 * 1000;

export const cleanupOldConversations = task({
	id: "cleanup-old-conversations",
	// concurrencyLimit is set via the queue — not a direct field on `task()`
	queue: { concurrencyLimit: 1 },
	run: async () => {
		// ── Step 1: prune empty bot conversations ────────────────────────────────
		// These are created by /newchat (or first-message routing) but never received
		// a reply. They are hidden from the sidebar already; this just keeps the DB clean.
		const emptyBotCutoff = new Date(Date.now() - EMPTY_BOT_CONV_TTL_MS);
		const emptyBotConvs = await db.conversation.findMany({
			where: {
				botSource: { not: null },
				messages: { none: {} },
				createdAt: { lt: emptyBotCutoff },
			},
			select: { id: true },
		});

		if (emptyBotConvs.length > 0) {
			await db.conversation.deleteMany({
				where: { id: { in: emptyBotConvs.map((c) => c.id) } },
			});
			logger.log(`Pruned ${emptyBotConvs.length} empty bot conversation(s).`);
		}

		// ── Step 2: prune old conversations by retention window ──────────────────
		const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

		// Fetch conversations inactive for more than 30 days
		const oldConversations = await db.conversation.findMany({
			where: { updatedAt: { lt: cutoff } },
			select: { id: true },
		});

		if (oldConversations.length === 0) {
			logger.log("no old conversations.");
			return { deleted: 0 };
		}

		const convIds = oldConversations.map((c) => c.id);
		logger.log(`Found ${convIds.length} old conversations — deleting...`);

		// Delete R2 objects for all images in these conversations.
		// Skip if PRESERVE_IMAGES=true — MCP servers may store these URLs externally.
		const preserveImages = process.env.PRESERVE_IMAGES === "true";
		if (isStorageConfigured() && !preserveImages) {
			const messages = await db.message.findMany({
				where: { conversationId: { in: convIds } },
				select: { id: true },
			});
			const messageIds = messages.map((m) => m.id);

			if (messageIds.length > 0) {
				const images = await db.image.findMany({
					where: { messageId: { in: messageIds } },
					select: { key: true },
				});

				if (images.length > 0) {
					logger.log(`Deleting ${images.length} images from R2...`);
					await deleteManyFromR2(images.map((img) => img.key));
				}
			}
		}

		// Cascade delete: Conversation → Message → Image (via onDelete: Cascade in the schema)
		await db.conversation.deleteMany({
			where: { id: { in: convIds } },
		});

		logger.log(`Successfully deleted ${convIds.length} old conversations.`);
		return { deleted: convIds.length };
	},
});

// ── Cron schedule — every day at midnight UTC ────────────────
export const cleanupOldConversationsCron = schedules.task({
	id: "cleanup-old-conversations-cron",
	cron: "0 0 * * *",
	// concurrencyLimit is set via the queue — not a direct field on `task()`
	queue: { concurrencyLimit: 1 },
	run: async () => {
		return cleanupOldConversations.triggerAndWait();
	},
});
