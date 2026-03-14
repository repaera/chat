"use client";
import { appConfig } from "@/lib/app-config";

import { useState, useEffect, useRef, useCallback } from "react";
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
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Link from "next/link";
import ChatClient from "@/components/chat/ChatClient";
import { TypedText } from "@/components/chat/TypedText";
import { useLocale } from "@/components/providers/LocaleProvider";
import { Bot, X, MoreHorizontal, Plus, LifeBuoy } from "lucide-react";

type Conversation = {
  id: string;
  title: string | null;
  updatedAt: Date;
  preview: string | null;
};

type Props = {
  user: { name: string; email: string };
  activeConversationId: string | null;
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
            <Bot className="w-4 h-4" />
            <span className="text-sm font-semibold text-sidebar-foreground">{appConfig.name}</span>
          </div>
          <div className="px-2 pb-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground"
              onClick={onNewChat}
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
                        onClick={() => onSelectConversation(conv.id)}
                        className="min-w-0 flex-col items-start py-2.5 h-auto"
                      >
                        <p className="w-full truncate font-medium text-sidebar-foreground">
                          {conv.title ?? cl.untitledConversation}
                        </p>
                        {conv.preview && (
                          <p className="w-full truncate text-sidebar-foreground/50">
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
                    <p className="truncate text-xs text-sidebar-foreground/50">{user.email}</p>
                  </div>
                  <MoreHorizontal className="w-4 h-4 text-sidebar-foreground/40" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="w-48">
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href="/settings">{cl.settings}</Link>
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

export default function ChatLayout({ user, activeConversationId }: Props) {
  const { t } = useLocale();
  const cl = t.chatLayout;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoadingConvos, setIsLoadingConvos] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const [currentId, setCurrentId] = useState(activeConversationId);
  const [chatKey, setChatKey] = useState(activeConversationId ?? "root");
  const [justCreated, setJustCreated] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);

  // Stable ref for load-more state — avoids stale closures in the observer callback
  const loadMoreStateRef = useRef({ hasMore, isFetchingMore, conversations });
  useEffect(() => {
    loadMoreStateRef.current = { hasMore, isFetchingMore, conversations };
  }, [hasMore, isFetchingMore, conversations]);

  // ── Initial fetch ────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((data: { conversations: Conversation[]; hasMore: boolean }) => {
        setConversations(
          data.conversations.map((c) => ({ ...c, updatedAt: new Date(c.updatedAt) })),
        );
        setHasMore(data.hasMore);
      })
      .catch(() => {})
      .finally(() => setIsLoadingConvos(false));
  }, []);

  // ── Load more (cursor pagination) ────────────────────────────────────────
  const loadMoreConversations = useCallback(async () => {
    const state = loadMoreStateRef.current;
    if (!state.hasMore || state.isFetchingMore) return;

    setIsFetchingMore(true);
    loadMoreStateRef.current.isFetchingMore = true; // optimistic lock

    const cursor = state.conversations.at(-1)?.updatedAt.toISOString();
    if (!cursor) { setIsFetchingMore(false); return; }

    try {
      const res = await fetch(`/api/conversations?cursor=${encodeURIComponent(cursor)}`);
      if (res.ok) {
        const data: { conversations: Conversation[]; hasMore: boolean } = await res.json();
        setConversations((prev) => [
          ...prev,
          ...data.conversations.map((c) => ({ ...c, updatedAt: new Date(c.updatedAt) })),
        ]);
        setHasMore(data.hasMore);
      }
    } catch {
      // silently ignore — user can scroll again to retry
    } finally {
      setIsFetchingMore(false);
    }
  }, []);

  // ── IntersectionObserver — fires when sentinel enters view ───────────────
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMoreConversations();
      },
      { threshold: 0 },
    );
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadMoreConversations]);

  // ── Conversation handlers ─────────────────────────────────────────────────
  const handleDeleteConversation = async (id: string) => {
    const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error(cl.toasts.deleteFailed);
      return;
    }
    setConversations((prev) => prev.filter((c) => c.id !== id));
    toast.success(cl.toasts.deleteSuccess);
    if (currentId === id) {
      setCurrentId(null);
      setChatKey("root");
      window.history.replaceState({}, "", "/");
    }
  };

  return (
    <div className="flex h-svh overflow-hidden bg-background">
      <SidebarProvider defaultOpen={true}>
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
            setChatKey("root");
            window.history.pushState({}, "", "/");
          }}
        />

        <SidebarInset className="flex flex-col min-h-0 overflow-hidden">
          {/* Topbar — trigger + active title */}
          <header className="flex h-12 md:h-14 shrink-0 items-center gap-2 px-3 z-10">
            <SidebarTrigger className="h-7 w-7 md:h-9 md:w-9 md:[&_svg]:size-5!" />
            <p className="truncate text-sm md:text-base font-medium text-muted-foreground flex-1 self-center">
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
            </p>
            {appConfig.helpCenterUrl && (
              <Button variant="ghost" asChild className="shrink-0 h-8 w-8 md:h-9 md:w-auto md:px-3 text-muted-foreground hover:text-foreground self-center">
                <a href={appConfig.helpCenterUrl} target="_blank" rel="noopener noreferrer" aria-label="Help center">
                  <LifeBuoy className="size-4 md:size-5" />
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
            onConversationCreated={(newId, title) => {
              setConversations((prev) => [
                { id: newId, title: title, updatedAt: new Date(), preview: title },
                ...prev,
              ]);
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
