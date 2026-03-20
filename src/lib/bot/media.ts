// src/lib/bot/media.ts
// Downloads images from platform-native storage and re-hosts them on R2.
// Returns the same { url, mediaType, key } shape used by the web upload flow.

import "server-only";

import { uploadToR2 } from "@/lib/storage";
import { newId } from "@/lib/id";

export type MediaDownload = { url: string; mediaType: string; key: string };

function isStorageReady(): boolean {
	return !!(
		process.env.R2_ACCOUNT_ID &&
		process.env.R2_ACCESS_KEY_ID &&
		process.env.R2_SECRET_ACCESS_KEY &&
		process.env.R2_BUCKET_NAME &&
		process.env.R2_PUBLIC_URL
	);
}

const EXT_TO_MIME: Record<string, string> = {
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	gif: "image/gif",
	webp: "image/webp",
};

// Telegram: resolve file_id → download bytes → upload to R2.
export async function downloadTelegramImage(
	botToken: string,
	fileId: string,
	userId: string,
): Promise<MediaDownload | null> {
	if (!isStorageReady()) return null;
	try {
		const fileRes = await fetch(
			`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`,
			{ signal: AbortSignal.timeout(10_000) },
		);
		if (!fileRes.ok) return null;
		const fileData = await fileRes.json();
		const filePath: string | undefined = (fileData as Record<string, Record<string, string>>).result?.file_path;
		if (!filePath) return null;

		const imgRes = await fetch(
			`https://api.telegram.org/file/bot${botToken}/${filePath}`,
			{ signal: AbortSignal.timeout(30_000) },
		);
		if (!imgRes.ok) return null;

		const ext = filePath.split(".").pop()?.toLowerCase() ?? "jpg";
		const mediaType = EXT_TO_MIME[ext] ?? "image/jpeg";
		const key = `uploads/${userId}/${newId()}.${ext}`;
		const url = await uploadToR2({ key, body: new Uint8Array(await imgRes.arrayBuffer()), contentType: mediaType });
		return { url, mediaType, key };
	} catch {
		return null;
	}
}

// WhatsApp Business Cloud: resolve media_id → download bytes → upload to R2.
export async function downloadWhatsAppImage(
	mediaId: string,
	accessToken: string,
	userId: string,
): Promise<MediaDownload | null> {
	if (!isStorageReady()) return null;
	try {
		const metaRes = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, {
			headers: { Authorization: `Bearer ${accessToken}` },
			signal: AbortSignal.timeout(10_000),
		});
		if (!metaRes.ok) return null;
		const meta = await metaRes.json() as Record<string, string>;
		const mediaUrl = meta.url;
		const mimeType = meta.mime_type ?? "image/jpeg";
		if (!mediaUrl) return null;

		const imgRes = await fetch(mediaUrl, {
			headers: { Authorization: `Bearer ${accessToken}` },
			signal: AbortSignal.timeout(30_000),
		});
		if (!imgRes.ok) return null;

		const ext = mimeType.split("/")[1] ?? "jpg";
		const key = `uploads/${userId}/${newId()}.${ext}`;
		const url = await uploadToR2({ key, body: new Uint8Array(await imgRes.arrayBuffer()), contentType: mimeType });
		return { url, mediaType: mimeType, key };
	} catch {
		return null;
	}
}

// Discord: CDN URLs are directly fetchable without auth.
export async function downloadDiscordImage(
	imageUrl: string,
	userId: string,
): Promise<MediaDownload | null> {
	if (!isStorageReady()) return null;
	try {
		const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(30_000) });
		if (!imgRes.ok) return null;
		const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
		const ext = contentType.split("/")[1]?.split(";")[0] ?? "jpg";
		const key = `uploads/${userId}/${newId()}.${ext}`;
		const url = await uploadToR2({ key, body: new Uint8Array(await imgRes.arrayBuffer()), contentType });
		return { url, mediaType: contentType, key };
	} catch {
		return null;
	}
}

// Slack: file downloads require the bot token in Authorization header.
export async function downloadSlackImage(
	fileUrl: string,
	botToken: string,
	userId: string,
): Promise<MediaDownload | null> {
	if (!isStorageReady()) return null;
	try {
		const imgRes = await fetch(fileUrl, {
			headers: { Authorization: `Bearer ${botToken}` },
			signal: AbortSignal.timeout(30_000),
		});
		if (!imgRes.ok) return null;
		const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
		const ext = contentType.split("/")[1]?.split(";")[0] ?? "jpg";
		const key = `uploads/${userId}/${newId()}.${ext}`;
		const url = await uploadToR2({ key, body: new Uint8Array(await imgRes.arrayBuffer()), contentType });
		return { url, mediaType: contentType, key };
	} catch {
		return null;
	}
}
