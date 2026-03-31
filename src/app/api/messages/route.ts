// src/app/api/messages/route.ts

import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: Request) {
	// 1. Validate session using better-auth
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user) {
		return Response.json({ error: "Unauthorized." }, { status: 401 });
	}

	const { searchParams } = new URL(req.url);
	const conversationId = searchParams.get("conversationId");
	const cursor = searchParams.get("cursor");

	// Validate ID (can use the same generic UUID regex used in other route files)
	const idParsed = z
		.string()
		.regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
		.safeParse(conversationId);

	if (!idParsed.success) {
		return Response.json(
			{ error: "conversationId is not valid." },
			{ status: 400 },
		);
	}

	try {
		// 2. Query the database with cursor pagination
		const messages = await db.message.findMany({
			where: {
				conversationId: idParsed.data,
				conversation: {
					userId: session.user.id,
				},
			},
			orderBy: { createdAt: "desc" },
			take: 20,
			skip: cursor ? 1 : 0,
			cursor: cursor ? { id: cursor } : undefined,
			select: {
				id: true,
				role: true,
				content: true,
				customParts: true,
				createdAt: true,
				images: {
					select: { url: true, mimeType: true },
				},
			},
		});

		// Map to UIMessage — images as FileUIPart, ordering: text first, images after
		// (rendered in ChatClient as images on top, text below)
		const uiMessages = messages
			.reverse()
			.map((msg) => {
				// Parse custom parts (location, commute) — stored as JSON string
				const customParts: any[] = msg.customParts
					? JSON.parse(msg.customParts)
					: [];

				return {
					id: msg.id,
					role: msg.role as "user" | "assistant",
					createdAt: msg.createdAt,
					parts: [
						...customParts,
						...(msg.content
							? [{ type: "text" as const, text: msg.content }]
							: []),
						...msg.images.map((img) => ({
							type: "file" as const,
							mediaType: img.mimeType,
							url: img.url,
						})),
					],
				};
			})
			.filter((msg) => msg.parts.length > 0);

		return Response.json({ messages: uiMessages });
	} catch (error) {
		console.error("[GET /api/messages] Error:", error);
		return Response.json(
			{ error: "Failed to fetch messages." },
			{ status: 500 },
		);
	}
}
