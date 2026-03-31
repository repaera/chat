import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import ChatLayout from "@/components/layout/ChatLayout";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type Props = { params: Promise<{ id: string }> };

// generateMetadata also validates ownership — prevents leaking titles of other users' conversations via URL
// (e.g. another user's conversation via URL /chat/<other-user-uuid>)
export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { id } = await params;
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user) return {};

	const conversation = await db.conversation.findFirst({
		where: { id, userId: session.user.id },
		select: { title: true },
	});

	// If the conversation is not found, the page component's notFound() will handle it
	// Title left empty — layout.tsx template ("%s | Chat") still applies
	return { title: conversation?.title ?? undefined };
}

export default async function ConversationPage({ params }: Props) {
	const { id } = await params;
	const [session, cookieStore] = await Promise.all([
		auth.api.getSession({ headers: await headers() }),
		cookies(),
	]);
	if (!session?.user) redirect("/login");

	const sidebarDefaultOpen =
		cookieStore.get("sidebar_state")?.value !== "false";

	// Single query with select only — do not mix include + select at different levels
	// (Prisma does not allow include and select at the same level)
	const conversation = await db.conversation.findFirst({
		where: { id, userId: session.user.id },
		select: { id: true, title: true },
	});

	if (!conversation) notFound();

	return (
		<ChatLayout
			user={{ name: session.user.name ?? "User", email: session.user.email }}
			activeConversationId={id}
			sidebarDefaultOpen={sidebarDefaultOpen}
		/>
	);
}
