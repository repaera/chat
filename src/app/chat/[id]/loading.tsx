// src/app/chat/[id]/loading.tsx
// Automatically rendered by Next.js App Router while page.tsx fetches data (SSR).
// Matches ChatLayout structure: sidebar (hidden on mobile) + main chat area + skeleton bubbles.

export default function ChatLoading() {
  return (
    <div className="flex h-svh overflow-hidden bg-background">
      {/* Sidebar placeholder — lebar sama dengan AppSidebar saat collapsed */}
      <div className="hidden md:flex w-[var(--sidebar-width,240px)] shrink-0" />

      {/* Main area */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-background">
        {/* Topbar */}
        <header className="flex h-12 shrink-0 items-center gap-2 px-3 border-b">
          <div className="w-6 h-6 rounded bg-muted animate-pulse" />
          <div className="w-32 h-3.5 rounded bg-muted animate-pulse" />
        </header>

        {/* Chat messages skeleton */}
        <div className="flex-1 overflow-hidden px-4 py-6">
          <div className="max-w-2xl mx-auto w-full flex flex-col gap-6">
            <SkeletonBubble role="assistant" lines={2} width="70%" />
            <SkeletonBubble role="user"      lines={1} width="40%" />
            <SkeletonBubble role="assistant" lines={3} width="80%" />
            <SkeletonBubble role="user"      lines={1} width="55%" />
            <SkeletonBubble role="assistant" lines={2} width="65%" />
          </div>
        </div>

        {/* Input area placeholder */}
        <div className="shrink-0 px-4 pb-4">
          <div className="max-w-2xl mx-auto">
            <div className="rounded-2xl border bg-background p-3">
              <div className="h-8 rounded bg-muted animate-pulse" />
              <div className="mt-2 flex justify-end">
                <div className="w-8 h-8 rounded-xl bg-muted animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton bubble ───────────────────────────────────────────────────────────

function SkeletonBubble({
  role,
  lines,
  width,
}: {
  role: "user" | "assistant";
  lines: number;
  width: string;
}) {
  const isUser = role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="shrink-0 w-7 h-7 rounded-lg bg-muted animate-pulse mt-0.5" />
      )}
      <div
        className={`rounded-2xl px-3.5 py-2.5 flex flex-col gap-2 bg-muted`}
        style={{ width, minWidth: "60px" }}
      >
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-3 rounded animate-pulse bg-muted-foreground/20"
            // Last line slightly shorter — looks more natural
            style={{ width: i === lines - 1 && lines > 1 ? "65%" : "100%" }}
          />
        ))}
      </div>
    </div>
  );
}