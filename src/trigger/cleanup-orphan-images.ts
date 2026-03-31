// src/trigger/cleanup-orphan-images.ts

import { logger, schedules, task } from "@trigger.dev/sdk/v3";
import { db } from "@/lib/db";
import { deleteManyFromR2, isStorageConfigured } from "@/lib/storage";

const ORPHAN_TTL_MS = 60 * 60 * 1000; // 1 hour

// ── Cleanup logic — can be called directly or via cron ─────
export const cleanupOrphanImages = task({
	id: "cleanup-orphan-images",
	// Only 1 concurrent run — no need for more, and safe for the free tier
	// concurrencyLimit is set via the queue — not a direct field on `task()`
	queue: { concurrencyLimit: 1 },
	run: async () => {
		if (!isStorageConfigured()) {
			logger.warn("R2 is not configured — skip cleanup.");
			return { skipped: true };
		}

		const cutoff = new Date(Date.now() - ORPHAN_TTL_MS);

		// Orphan = messageId null + lastSeenAt past cutoff (no heartbeat)
		const orphans = await db.image.findMany({
			where: {
				messageId: null,
				lastSeenAt: { lt: cutoff },
			},
			select: { id: true, key: true },
		});

		if (orphans.length === 0) {
			logger.log("No orphan images found.");
			return { deleted: 0 };
		}

		logger.log(`Found ${orphans.length} orphan images — deleting from R2...`);

		// Delete from R2 first, then the DB
		await deleteManyFromR2(orphans.map((img) => img.key));

		await db.image.deleteMany({
			where: { id: { in: orphans.map((img) => img.id) } },
		});

		logger.log(`Successfully deleted ${orphans.length} orphan images.`);
		return { deleted: orphans.length };
	},
});

// ── Cron schedule — every hour ──────────────────────────────────
export const cleanupOrphanImagesCron = schedules.task({
	id: "cleanup-orphan-images-cron",
	// Hourly at minute 0
	cron: "0 * * * *",
	// concurrencyLimit is set via the queue — not a direct field on `task()`
	queue: { concurrencyLimit: 1 },
	run: async () => {
		return cleanupOrphanImages.triggerAndWait();
	},
});
