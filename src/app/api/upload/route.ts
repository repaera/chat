// src/app/api/upload/route.ts

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES } from "@/lib/schemas";
import { isStorageConfigured, uploadToR2 } from "@/lib/storage";

// ── POST /api/upload ──────────────────────────────────────────
// Accept multipart/form-data, validate, upload to R2,
// create Image record in DB, return { url, key, imageId }.
export async function POST(req: Request) {
	// Storage must be configured before this endpoint is active
	if (!isStorageConfigured()) {
		return Response.json(
			{ error: "Image upload is not configured." },
			{ status: 503 },
		);
	}

	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user) {
		return Response.json({ error: "Unauthorized." }, { status: 401 });
	}

	// Parse multipart form
	let formData: FormData;
	try {
		formData = await req.formData();
	} catch {
		return Response.json({ error: "Request is not valid." }, { status: 400 });
	}

	const file = formData.get("file");
	if (!(file instanceof File)) {
		return Response.json({ error: "Field 'file' not found." }, { status: 400 });
	}

	// Validate file type
	if (
		!ALLOWED_IMAGE_TYPES.includes(
			file.type as (typeof ALLOWED_IMAGE_TYPES)[number],
		)
	) {
		return Response.json(
			{
				error: `File type not supported. Use: ${ALLOWED_IMAGE_TYPES.join(", ")}`,
			},
			{ status: 415 },
		);
	}

	// Validate file size
	if (file.size > MAX_IMAGE_SIZE_BYTES) {
		return Response.json(
			{
				error: `File size exceeds limit of ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024}MB.`,
			},
			{ status: 413 },
		);
	}

	// Determine extension from MIME type
	const extMap: Record<string, string> = {
		"image/jpeg": "jpg",
		"image/png": "png",
		"image/gif": "gif",
		"image/webp": "webp",
	};
	const ext = extMap[file.type] ?? "jpg";
	const imageId = newId();
	const key = `uploads/${session.user.id}/${imageId}.${ext}`;

	// Upload to R2
	const buffer = Buffer.from(await file.arrayBuffer());
	let publicUrl: string;
	try {
		publicUrl = await uploadToR2({ key, body: buffer, contentType: file.type });
	} catch (err) {
		console.error("[upload] R2 error:", err);
		return Response.json({ error: "Failed to upload file." }, { status: 500 });
	}

	// Save Image record to DB — messageId null = orphan
	await db.image.create({
		data: {
			id: imageId,
			userId: session.user.id,
			key,
			url: publicUrl,
			sizeBytes: file.size,
			mimeType: file.type,
		},
	});

	return Response.json({ url: publicUrl, key, imageId }, { status: 201 });
}
