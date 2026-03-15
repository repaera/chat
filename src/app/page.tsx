import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers, cookies } from "next/headers";
import ChatLayout from "@/components/layout/ChatLayout";

export default async function HomePage() {
  const [session, cookieStore] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    cookies(),
  ]);
  if (!session?.user) redirect("/login");

  const sidebarDefaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <ChatLayout
      user={{ name: session.user.name ?? "User", email: session.user.email }}
      activeConversationId={null}
      sidebarDefaultOpen={sidebarDefaultOpen}
    />
  );
}
