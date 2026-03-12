import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { headers } from "next/headers";
import ChatLayout from "@/components/layout/ChatLayout";

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const rawConversations = await db.conversation.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      updatedAt: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true },
      },
    },
  });

  // Map to the shape expected by ChatLayout — preview from the last message
  const conversations = rawConversations.map((c) => ({
    id: c.id,
    title: c.title,
    updatedAt: c.updatedAt,
    preview: c.messages[0]?.content ?? null,
  }));

  return (
    <ChatLayout
      user={{ name: session.user.name ?? "User", email: session.user.email }}
      conversations={conversations}
      activeConversationId={null}
    />
  );
}
