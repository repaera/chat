// src/app/api/conversations/[id]/route.ts

import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteManyFromR2, isStorageConfigured } from "@/lib/storage";

// ── DELETE /api/conversations/[id] ───────────────────────────
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;

  // z.string().uuid() only validates UUID v4 — use a generic regex so UUID v7 passes
  const idParsed = z.string().regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "ID must be a valid UUID."
  ).safeParse(id);
  if (!idParsed.success) {
    return Response.json({ error: "ID is not valid." }, { status: 400 });
  }

  const existing = await db.conversation.findFirst({
    where: { id: idParsed.data, userId: session.user.id },
    select: { id: true },
  });
  if (!existing) {
    return Response.json({ error: "Conversation not found." }, { status: 404 });
  }

  // Before deleting the DB record, delete R2 objects for all Images
  // whose messageId belongs to this conversation.
  // Must be done before the cascade delete removes Message rows.
  // Skip if PRESERVE_IMAGES=true — MCP servers may store these URLs externally.
  const preserveImages = process.env.PRESERVE_IMAGES === "true";
  if (isStorageConfigured() && !preserveImages) {
    // Fetch all messageIds in this conversation
    const messages = await db.message.findMany({
      where: { conversationId: idParsed.data },
      select: { id: true },
    });
    const messageIds = messages.map((m) => m.id);

    if (messageIds.length > 0) {
      const images = await db.image.findMany({
        where: { messageId: { in: messageIds } },
        select: { key: true },
      });

      if (images.length > 0) {
        await deleteManyFromR2(images.map((img) => img.key)).catch((err) => {
          // Non-fatal — continue deleting DB record even if R2 delete fails
          console.error("[delete-conv] R2 delete error:", err);
        });
      }
    }
  }

  // Cascade delete: Conversation → Message → (Image rows removed via onDelete Cascade)
  await db.conversation.delete({ where: { id: idParsed.data } });

  return Response.json({ success: true });
}