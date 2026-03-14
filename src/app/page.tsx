import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import ChatLayout from "@/components/layout/ChatLayout";

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  return (
    <ChatLayout
      user={{ name: session.user.name ?? "User", email: session.user.email }}
      activeConversationId={null}
    />
  );
}
