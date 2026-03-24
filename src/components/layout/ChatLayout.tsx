"use client";
import { appConfig } from "@/lib/app-config";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import ChatClient from "@/components/chat/ChatClient";
import { TypedText } from "@/components/chat/TypedText";
import { useLocale } from "@/components/providers/LocaleProvider";
import { X, MoreHorizontal, Plus, LifeBuoy, AlertTriangle } from "lucide-react";

type Conversation = {
  id: string;
  title: string | null;
  updatedAt: Date;
  preview: string | null;
};

type Props = {
  user: { name: string; email: string };
  activeConversationId: string | null;
  sidebarDefaultOpen?: boolean;
};

// ── Skeleton rows shown while the first page is loading ───────────────────
function ConvoSkeleton() {
  return (
    <div className="px-2 pt-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1.5 px-2 py-2.5">
          <div
            className="h-3 rounded bg-sidebar-accent animate-pulse"
            style={{ width: `${55 + (i % 3) * 15}%` }}
          />
          <div
            className="h-2.5 rounded bg-sidebar-accent/50 animate-pulse"
            style={{ width: `${35 + (i % 4) * 10}%` }}
          />
        </div>
      ))}
    </div>
  );
}

function AppSidebar({
  user,
  conversations,
  activeConversationId,
  isLoadingConvos,
  isFetchingMore,
  sentinelRef,
  onDeleteConversation,
  onSelectConversation,
  onNewChat,
}: {
  user: Props["user"];
  conversations: Conversation[];
  activeConversationId: string | null;
  isLoadingConvos: boolean;
  isFetchingMore: boolean;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  onDeleteConversation: (id: string) => void;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
}) {
  const { t } = useLocale();
  const cl = t.chatLayout;
  const { isMobile, setOpenMobile } = useSidebar();

  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <>
      <Sidebar>
        {/* Header */}
        <SidebarHeader>
          <div className="flex items-center gap-2 px-0 py-3">
            <img src={appConfig.iconSvg ?? "/icon.svg"} alt="" className="size-8" />
            <span className="text-base font-semibold text-sidebar-foreground">{appConfig.name}</span>
            <SidebarTrigger className="md:hidden ml-auto h-8 w-8 [&_svg]:size-5! text-neutral-600" />
          </div>
          <div className="px-2 pb-2">
            <Button
              variant="outline"
              size="lg"
              className="w-full justify-start gap-2 text-sm text-neutral-600 hover:text-sidebar-foreground"
              onClick={() => {
              if (isMobile) {
                setOpenMobile(false);
                setTimeout(() => onNewChat(), 320);
              } else {
                onNewChat();
              }
            }}
            >
              <Plus className="w-4 h-4" />
              {cl.newButton}
            </Button>
          </div>
        </SidebarHeader>

        {/* Conversation list */}
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              {isLoadingConvos ? (
                <ConvoSkeleton />
              ) : conversations.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-sidebar-foreground/40">
                  {cl.emptyState}
                </p>
              ) : (
                <SidebarMenu>
                  {conversations.map((conv) => (
                    <SidebarMenuItem key={conv.id} className="group/item">
                      <SidebarMenuButton
                        isActive={activeConversationId === conv.id}
                        onClick={() => {
                          if (isMobile) {
                            setOpenMobile(false);
                            setTimeout(() => onSelectConversation(conv.id), 320);
                          } else {
                            onSelectConversation(conv.id);
                          }
                        }}
                        className="min-w-0 flex-col items-start py-2.5 h-auto"
                      >
                        <p className="w-full truncate font-medium text-sidebar-foreground">
                          {conv.title ?? cl.untitledConversation}
                        </p>
                        {conv.preview && (
                          <p className="w-full truncate text-neutral-600">
                            {conv.preview}
                          </p>
                        )}
                      </SidebarMenuButton>
                      <SidebarMenuAction
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(conv.id);
                        }}
                      >
                        <X className="w-3 h-3" />
                      </SidebarMenuAction>
                    </SidebarMenuItem>
                  ))}

                  {/* Infinite scroll sentinel */}
                  <div ref={sentinelRef} className="h-1" />

                  {isFetchingMore && (
                    <div className="flex justify-center py-3">
                      <span className="text-xs text-sidebar-foreground/30 animate-pulse">•••</span>
                    </div>
                  )}
                </SidebarMenu>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* User footer */}
        <SidebarFooter>
          <div className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent shadow-sm ring-1 ring-sidebar-border">
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className="bg-sidebar-accent text-xs text-sidebar-accent-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-sidebar-foreground">{user.name}</p>
                    <p className="truncate text-xs text-neutral-600">{user.email}</p>
                  </div>
                  <MoreHorizontal className="w-4 h-4 text-sidebar-foreground/40" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="w-48">
                <DropdownMenuItem className="cursor-pointer" onSelect={() => router.push("/settings")}>
                  {cl.settings}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                  {cl.signOut}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </SidebarFooter>
      </Sidebar>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{cl.deleteDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {cl.deleteDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{cl.deleteDialog.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) onDeleteConversation(deleteTarget);
                setDeleteTarget(null);
                if (isMobile) setOpenMobile(false);
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {cl.deleteDialog.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function ChatLayout({ user, activeConversationId, sidebarDefaultOpen = true }: Props) {
  const { t } = useLocale();
  const cl = t.chatLayout;

  const queryClient = useQueryClient();

  const [quota, setQuota] = useState<{ remaining: number; limit: number } | null>(null);
  const fetchQuota = useCallback(async () => {
    try {
      const res = await fetch("/api/quota");
      if (!res.ok) return;
      const data = await res.json() as { unlimited?: boolean; remaining?: number; limit?: number };
      if (data.unlimited) { setQuota(null); return; }
      if (typeof data.remaining === "number" && typeof data.limit === "number") {
        setQuota({ remaining: data.remaining, limit: data.limit });
      }
    } catch {}
  }, []);

  useEffect(() => { void fetchQuota(); }, [fetchQuota]);

  const {
    data,
    isLoading: isLoadingConvos,
    isFetchingNextPage: isFetchingMore,
    hasNextPage: hasMore,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ["conversations"],
    queryFn: async ({ pageParam }) => {
      const url = pageParam
        ? `/api/conversations?cursor=${encodeURIComponent(pageParam as string)}`
        : "/api/conversations";
      const res = await fetch(url);
      if (!res.ok) throw new Error("failed to fetch conversations");
      const json = await res.json() as { conversations: Conversation[]; hasMore: boolean };
      return {
        ...json,
        conversations: json.conversations.map((c) => ({ ...c, updatedAt: new Date(c.updatedAt) })),
      };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.conversations.at(-1)?.updatedAt.toISOString() : undefined,
    // Poll every 10s so bot-originated conversations appear without a manual refresh.
    // Only runs while the tab is focused — no background traffic.
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });

  const conversations = useMemo(
    () => data?.pages.flatMap((p) => p.conversations) ?? [],
    [data],
  );

  const [currentId, setCurrentId] = useState(activeConversationId);
  const [chatKey, setChatKey] = useState(activeConversationId ?? "root");
  const [justCreated, setJustCreated] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);

  // ── IntersectionObserver — fires when sentinel enters view ───────────────
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetchingMore) fetchNextPage();
      },
      { threshold: 0 },
    );
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [fetchNextPage, hasMore, isFetchingMore]);

  // ── Conversation handlers ─────────────────────────────────────────────────
  const handleDeleteConversation = async (id: string) => {
    const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error(cl.toasts.deleteFailed);
      return;
    }
    queryClient.setQueryData(
      ["conversations"],
      (old: InfiniteData<{ conversations: Conversation[]; hasMore: boolean }> | undefined) =>
        old
          ? {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                conversations: page.conversations.filter((c) => c.id !== id),
              })),
            }
          : old,
    );
    toast.success(cl.toasts.deleteSuccess);
    if (currentId === id) {
      setCurrentId(null);
      setChatKey(`root-${Date.now()}`);
      window.history.replaceState({}, "", "/");
    }
  };

  const QUOTA_WARN_THRESHOLD = 10;

  return (
    <div className="flex flex-col h-svh overflow-hidden bg-background">
      {quota !== null && quota.remaining <= QUOTA_WARN_THRESHOLD && (
        <div className="flex items-center gap-2 px-4 py-2 text-sm bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 shrink-0">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{t.chatClient.quotaWarning.replace("{n}", String(quota.remaining))}</span>
        </div>
      )}
      <SidebarProvider defaultOpen={sidebarDefaultOpen} style={{ minHeight: 0 }} className="flex-1">
        <AppSidebar
          user={user}
          conversations={conversations}
          activeConversationId={currentId}
          isLoadingConvos={isLoadingConvos}
          isFetchingMore={isFetchingMore}
          sentinelRef={sentinelRef}
          onDeleteConversation={handleDeleteConversation}
          onSelectConversation={(id) => {
            setJustCreated(false);
            setCurrentId(id);
            setChatKey(id);
            window.history.pushState({}, "", `/chat/${id}`);
          }}
          onNewChat={() => {
            setJustCreated(false);
            setCurrentId(null);
            setChatKey(`root-${Date.now()}`);
            window.history.pushState({}, "", "/");
          }}
        />

        <SidebarInset className="flex flex-col min-h-0 overflow-hidden">
          {/* Topbar — trigger + active title */}
          <header className="flex h-14 md:h-14 shrink-0 items-center gap-2 px-3 z-10">
            <SidebarTrigger className="h-9 w-9 [&_svg]:size-6! md:h-9 md:w-9 md:[&_svg]:size-5! text-neutral-600" />
            <p className="truncate text-base md:text-base font-medium text-muted-foreground flex-1 self-center">
              {isLoadingConvos && currentId ? (
                <span className="inline-block h-4 w-40 md:h-3 md:w-36 rounded bg-muted animate-pulse" />
              ) : (
                <TypedText
                  animate={justCreated}
                  typeSpeed={35}
                  text={currentId
                    ? (() => {
                        const activeConv = conversations.find((c) => c.id === currentId);
                        return activeConv?.title ?? activeConv?.preview ?? cl.untitledConversation;
                      })()
                    : appConfig.name}
                />
              )}
            </p>
            {appConfig.helpCenterUrl && (
              <Button variant="ghost" asChild className="shrink-0 h-9 w-9 md:h-9 md:w-auto md:px-3 text-muted-foreground hover:text-foreground self-center">
                <a href={appConfig.helpCenterUrl} target="_blank" rel="noopener noreferrer" aria-label="Help center">
                  <LifeBuoy className="size-6 md:size-5" />
                  <span className="hidden md:inline text-sm md:text-base">Help</span>
                </a>
              </Button>
            )}
          </header>

          {/* key={chatKey} — force remount ChatClient when switching/deleting a conversation */}
          {/* ensuring useChat state (messages) is clean; no old bubbles remain */}
          <ChatClient
            key={chatKey}
            activeConversationId={currentId}
            skipInitialFetch={justCreated}
            onQuotaUpdate={fetchQuota}
            quotaRemaining={quota?.remaining ?? null}
            onConversationCreated={(newId, title) => {
              queryClient.setQueryData(
                ["conversations"],
                (old: InfiniteData<{ conversations: Conversation[]; hasMore: boolean }> | undefined) => {
                  const newConv = { id: newId, title, updatedAt: new Date(), preview: title };
                  if (!old) return { pages: [{ conversations: [newConv], hasMore: false }], pageParams: [undefined] };
                  return {
                    ...old,
                    pages: [
                      { conversations: [newConv, ...old.pages[0].conversations], hasMore: old.pages[0].hasMore },
                      ...old.pages.slice(1),
                    ],
                  };
                },
              );
              setJustCreated(true);
              setCurrentId(newId); // update ID but DO NOT change chatKey — do not remount
              window.history.replaceState({}, "", `/chat/${newId}`);
            }}
          />
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
