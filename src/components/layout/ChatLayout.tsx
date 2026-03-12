"use client";
import { appConfig } from "@/lib/app-config";

import { useState, useEffect } from "react";
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
import { useLocale } from "@/components/providers/LocaleProvider";

type Conversation = {
  id: string;
  title: string | null;
  updatedAt: Date;
  preview: string | null;
};

type Props = {
  user: { name: string; email: string };
  conversations: Conversation[];
  activeConversationId: string | null;
};

function AppSidebar({
  user,
  conversations,
  activeConversationId,
  onDeleteConversation,
  onSelectConversation,
  onNewChat,
}: {
  user: Props["user"];
  conversations: Conversation[];
  activeConversationId: string | null;
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
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-base">✓</span>
              <span className="text-sm font-semibold text-zinc-100">{appConfig.name}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-zinc-400 hover:text-zinc-100"
              onClick={onNewChat}
            >
              {cl.newButton}
            </Button>
          </div>
        </SidebarHeader>

        {/* Conversation list */}
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              {conversations.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-zinc-600">
                  {cl.emptyState}
                </p>
              ) : (
                <SidebarMenu>
                  {conversations.map((conv) => (
                    <SidebarMenuItem key={conv.id} className="group/item">
                      <SidebarMenuButton
                        isActive={activeConversationId === conv.id}
                        onClick={() => onSelectConversation(conv.id)}
                        className="min-w-0 flex-col items-start py-2.5"
                      >
                        <p className="w-full truncate font-medium">
                          {conv.title ?? cl.untitledConversation}
                        </p>
                        {conv.preview && (
                          <p className="w-full truncate text-zinc-600">
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
                        ✕
                      </SidebarMenuAction>
                    </SidebarMenuItem>
                  ))}
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
                <button className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-zinc-800">
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className="bg-zinc-700 text-xs text-zinc-300">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-zinc-200">{user.name}</p>
                    <p className="truncate text-xs text-zinc-600">{user.email}</p>
                  </div>
                  <span className="text-xs text-zinc-600">⋯</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                side="top"
                className="w-48 border-zinc-800 bg-zinc-900"
              >
                <DropdownMenuItem
                  asChild
                  className="cursor-pointer text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100"
                >
                  <Link href="/settings">{cl.settings}</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-zinc-800" />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="cursor-pointer text-zinc-400 focus:bg-zinc-800 focus:text-zinc-100"
                >
                  {cl.signOut}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </SidebarFooter>
      </Sidebar>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="border-zinc-800 bg-zinc-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">{cl.deleteDialog.title}</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-500">
              {cl.deleteDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-700 bg-transparent text-zinc-300">
              {cl.deleteDialog.cancel}
            </AlertDialogCancel>
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

export default function ChatLayout({
  user,
  conversations: initialConversations,
  activeConversationId,
}: Props) {
  const { t } = useLocale();
  const cl = t.chatLayout;

  const router = useRouter();
  const [conversations, setConversations] = useState(initialConversations);
  const [currentId, setCurrentId] = useState(activeConversationId);
  const [chatKey, setChatKey] = useState(activeConversationId ?? "root");
  const [justCreated, setJustCreated] = useState(false);

  // NO useEffect to sync `activeConversationId`.
  // ChatLayout is remounted by Next.js on hard navigation to /chat/[id],
  // so the useState initial value is already correct from the server.
  // A useEffect here would trigger a remount of ChatClient when the URL changes via replaceState.

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
      setChatKey("root"); // force remount to a clean state
      window.history.replaceState({}, "", "/");
    }
  };

  return (
    <div className="flex h-svh overflow-hidden bg-zinc-950">
      <SidebarProvider defaultOpen={false}>
        <AppSidebar
          user={user}
          conversations={conversations}
          activeConversationId={currentId}
          onDeleteConversation={handleDeleteConversation}
          onSelectConversation={(id) => {
            setJustCreated(false);
            setCurrentId(id);
            setChatKey(id);
            window.history.pushState({}, '', `/chat/${id}`);
          }}
          onNewChat={() => {
            setJustCreated(false);
            setCurrentId(null);
            setChatKey("root");
            window.history.pushState({}, '', '/');
          }}
        />

        <SidebarInset className="flex flex-col min-h-0 overflow-hidden">
          {/* Topbar — trigger + active title */}
          <header className="flex h-12 shrink-0 items-center gap-2 px-3 z-10">
            <SidebarTrigger />
            <p className="truncate text-sm font-medium text-neutral-600">
              {currentId
                ? (() => {
                    const activeConv = conversations.find((c) => c.id === currentId);
                    // Prioritize optimistic title/preview before the static fallback
                    return activeConv?.title ?? activeConv?.preview ?? cl.untitledConversation;
                  })()
                : appConfig.name}
            </p>
          </header>

          {/* key={currentId} — force remount ChatClient when switching/deleting a conversation */}
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
              window.history.replaceState({}, '', `/chat/${newId}`);
            }}
          />
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
