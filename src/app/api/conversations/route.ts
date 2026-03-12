import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { createConversationSchema } from "@/lib/schemas";

// ── GET /api/conversations ────────────────────────────────────
// List all conversations belonging to the currently logged-in user,
// ordered by most recently updated.
// Used by ChatLayout to refresh the sidebar after a new conversation is created.
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const raw = await db.conversation.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true },
      },
    },
  });

  // Map to the shape expected by ChatLayout — preview is not messages[]
  const conversations = raw.map((c) => ({
    id: c.id,
    title: c.title,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    preview: c.messages[0]?.content ?? null,
  }));

  return Response.json({ conversations });
}

// ── POST /api/conversations ───────────────────────────────────
// Create a new conversation explicitly (optional — a conversation
// can also be created automatically by /api/chat when conversationId is not provided).
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = createConversationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Input is not valid.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const conversation = await db.conversation.create({
    data: {
      id: newId(), // UUID v7 — time-ordered
      userId: session.user.id,
      title: parsed.data.title ?? null,
    },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  });

  return Response.json({ conversation }, { status: 201 });
}