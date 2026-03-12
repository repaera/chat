// src/app/api/upload/heartbeat/route.ts

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { heartbeatSchema } from "@/lib/schemas";

// ── PATCH /api/upload/heartbeat ───────────────────────────────
// Refresh lastSeenAt for images that are still pending in the UI.
// Called every 15 minutes by the useImageHeartbeat hook.
// Prevent the orphan cleanup job from deleting images that are still actively displayed.
export async function PATCH(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = heartbeatSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "imageId is not valid." }, { status: 400 });
  }

  const { imageId } = parsed.data;

  // Ensure the image belongs to this user and is still an orphan (not attached)
  const image = await db.image.findFirst({
    where: {
      id: imageId,
      userId: session.user.id,
      messageId: null, // only orphans need heartbeat
    },
    select: { id: true },
  });

  if (!image) {
    // Already attached or not found — no update needed, return ok
    return Response.json({ ok: true });
  }

  await db.image.update({
    where: { id: imageId },
    data: { lastSeenAt: new Date() },
  });

  return Response.json({ ok: true });
}