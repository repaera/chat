// src/components/chat/ChatClient.tsx

"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRef, useEffect, useState, useMemo, useCallback, useLayoutEffect } from "react";
import { useImageHeartbeat } from "@/hooks/use-image-heartbeat";
import { toast } from "sonner";
import type { UIMessage } from "ai";
import { useLocale } from "@/components/providers/LocaleProvider";
import { appConfig } from "@/lib/app-config";
import { LocationDialog } from "@/components/chat/LocationDialog";
import { MessageList } from "@/components/chat/MessageList";
import { ChatInput, type PendingImage } from "@/components/chat/ChatInput";
import type { LocationPart, CommutePart, LocationAttachment } from "@/components/chat/location-types";

type Props = {
	activeConversationId: string | null;
	skipInitialFetch?: boolean;
	onConversationCreated?: (id: string, title: string | null) => void;
};

export default function ChatClient({
	activeConversationId,
	skipInitialFetch = false,
	onConversationCreated,
}: Props) {
	const { t } = useLocale();
	const cc = t.chatClient;

	// ── Refs ─────────────────────────────────────────────────────────────────
	const bottomRef = useRef<HTMLDivElement>(null);
	const topRef = useRef<HTMLDivElement>(null);
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const previousScrollRef = useRef<{ height: number; top: number } | null>(null);
	const lastMessageIdRef = useRef<string | null>(null);
	const skipInitialFetchRef = useRef(skipInitialFetch);
	const activeConversationIdRef = useRef(activeConversationId);
	const isMountedRef = useRef(false);
	// Ref for onConversationCreated — avoid stale closure in the transport memo
	const onConversationCreatedRef = useRef(onConversationCreated);

	// ── State ─────────────────────────────────────────────────────────────────
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [hasMore, setHasMore] = useState(true);
	const [isInitialLoading, setIsInitialLoading] = useState(!!activeConversationId);
	const [input, setInput] = useState("");
	const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
	const [locationDialogOpen, setLocationDialogOpen] = useState(false);
	const [pendingLocation, setPendingLocation] = useState<LocationAttachment | null>(null);

	// Heartbeat every 15 minutes — prevent cleanup job from deleting images that are still pending
	useImageHeartbeat(pendingImage?.imageId ?? null);

	// Keep refs fresh without re-creating the transport memo
	useEffect(() => {
		onConversationCreatedRef.current = onConversationCreated;
	}, [onConversationCreated]);

	useEffect(() => {
		skipInitialFetchRef.current = skipInitialFetch;
	}, [skipInitialFetch]);

	useEffect(() => {
		activeConversationIdRef.current = activeConversationId;

		if (activeConversationId === null) {
			setMessages([]);
			setPendingImage(null);
			setHasMore(false);
		} else if (!skipInitialFetchRef.current) {
			setHasMore(true);
		}

		// Reset mount flag when switching conversations so scroll doesn't auto-trigger
		isMountedRef.current = false;
	}, [activeConversationId]);

	// ── Transport ─────────────────────────────────────────────────────────────
	// Memoized to avoid re-creation on every render — refs remain fresh
	// because they are read at call-time, not at memo creation time.
	const transport = useMemo(
		() =>
			new DefaultChatTransport({
				api: "/api/chat",
				prepareSendMessagesRequest({ messages, id }) {
					return {
						body: {
							messages,
							id,
							conversationId: activeConversationIdRef.current || undefined,
							timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
							currentTime: new Date().toLocaleTimeString([], {
								hour: "2-digit",
								minute: "2-digit",
								hour12: false,
							}),
						},
					};
				},
				async fetch(url, init) {
					const response = await globalThis.fetch(url, init);
					const newId = response.headers.get("X-Conversation-Id");
					if (
						newId &&
						newId !== activeConversationIdRef.current &&
						onConversationCreatedRef.current
					) {
						// OPTIMISTIC TITLE: extract user's typed text from the request payload
						let tempTitle = cc.newConversationTitle;
						try {
							if (init?.body) {
								const bodyParsed = JSON.parse(init.body as string);
								const msgs = bodyParsed.messages || [];
								const lastUserMsg = msgs.filter((m: any) => m.role === "user").pop();
								if (lastUserMsg) {
									const textPart = lastUserMsg.parts?.find((p: any) => p.type === "text")?.text;
									const content = textPart || lastUserMsg.content || "";
									if (content) {
										tempTitle = content.length > 30 ? content.slice(0, 30) + "..." : content;
									}
								}
							}
						} catch (error) {
							console.error("failed to extract temporary title", error);
						}
						onConversationCreatedRef.current?.(newId, tempTitle);
					}
					return response;
				},
			}),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[],
	);

	const { messages, sendMessage, setMessages, status } = useChat({
		messages: [],
		transport,
	});

	const isLoading = status === "streaming" || status === "submitted";

	// ── Pagination state ref (stable read inside callbacks) ───────────────────
	// FIX: Ref to store latest state so IntersectionObserver & loadMoreMessages remain stable
	const observerStateRef = useRef({ activeConversationId, messages, isLoadingMore, hasMore, setMessages });
	useEffect(() => {
		observerStateRef.current = { activeConversationId, messages, isLoadingMore, hasMore, setMessages };
	}, [activeConversationId, messages, isLoadingMore, hasMore, setMessages]);

	// ── Initial fetch ─────────────────────────────────────────────────────────
	useEffect(() => {
		if (!activeConversationId) {
			setIsInitialLoading(false);
			setHasMore(false);
			return;
		}

		// Skip fetch if the conversation was just created — messages are already in useChat
		if (skipInitialFetchRef.current) {
			setIsInitialLoading(false);
			setHasMore(false);
			return;
		}

		setIsInitialLoading(true);
		fetch(`/api/messages?conversationId=${activeConversationId}`)
			.then((r) => r.json())
			.then((data) => {
				const fetched: UIMessage[] = data.messages ?? [];
				isMountedRef.current = false; // reset so scroll effect knows this is the initial load
				setMessages(fetched);
				if (fetched.length < 20) setHasMore(false);
			})
			.catch(() => {})
			.finally(() => setIsInitialLoading(false));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeConversationId]);

	// ── Load-more (cursor pagination) ────────────────────────────────────────
	const PAGE_SIZE = 20;

	const loadMoreMessages = useCallback(async () => {
		const state = observerStateRef.current;

		// Don't load if: currently loading, already exhausted, no conversation,
		// or total messages < PAGE_SIZE (means all messages have been loaded from the server)
		if (
			state.isLoadingMore ||
			!state.hasMore ||
			!state.activeConversationId ||
			state.messages.length < PAGE_SIZE
		)
			return;

		setIsLoadingMore(true);
		observerStateRef.current.isLoadingMore = true; // Optimistic lock

		const oldestMessageId = state.messages[0]?.id;

		try {
			const res = await fetch(
				`/api/messages?conversationId=${state.activeConversationId}&cursor=${oldestMessageId}`,
			);
			if (res.ok) {
				const data = await res.json();
				const fetched = data.messages ?? [];

				if (fetched.length === 0) {
					setHasMore(false);
				} else {
					// Snapshot scroll position before prepending messages to prevent jumps
					if (scrollContainerRef.current) {
						previousScrollRef.current = {
							height: scrollContainerRef.current.scrollHeight,
							top: scrollContainerRef.current.scrollTop,
						};
					}
					state.setMessages((prev) => [...fetched, ...prev]);
					if (fetched.length < PAGE_SIZE) setHasMore(false);
				}
			} else {
				setHasMore(false);
			}
		} catch (error) {
			console.error("failed to load old messages:", error);
			setHasMore(false);
		} finally {
			setIsLoadingMore(false);
			observerStateRef.current.isLoadingMore = false;
		}
	}, []); // Empty dependency array — reads from observerStateRef at call-time

	// Restore scroll position after messages are prepended
	useLayoutEffect(() => {
		if (previousScrollRef.current && scrollContainerRef.current) {
			const container = scrollContainerRef.current;
			const heightDiff = container.scrollHeight - previousScrollRef.current.height;
			container.scrollTop = previousScrollRef.current.top + heightDiff;
			previousScrollRef.current = null;
		}
	}, [messages]);

	// IntersectionObserver — fires loadMoreMessages when topRef enters the viewport
	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && observerStateRef.current.hasMore) {
					loadMoreMessages();
				}
			},
			{
				root: scrollContainerRef.current, // Prevent misfires when the keyboard appears
				rootMargin: "100px 0px 0px 0px",
				threshold: 0,
			},
		);
		if (topRef.current) observer.observe(topRef.current);
		return () => observer.disconnect();
	}, [loadMoreMessages]);

	// Auto-scroll to bottom — only for NEW messages, not during initial load
	useEffect(() => {
		const currentLastMessage = messages[messages.length - 1];

		if (!isMountedRef.current) {
			isMountedRef.current = true;
			lastMessageIdRef.current = currentLastMessage?.id ?? null;
			bottomRef.current?.scrollIntoView({ behavior: "instant" });
			return;
		}

		const isNewMessageAtBottom = currentLastMessage?.id !== lastMessageIdRef.current;
		if (isNewMessageAtBottom || status === "streaming" || status === "submitted") {
			bottomRef.current?.scrollIntoView({ behavior: "smooth" });
			lastMessageIdRef.current = currentLastMessage?.id ?? null;
		}
	}, [messages, status]);

	// ── Handlers ──────────────────────────────────────────────────────────────

	const doSend = (text: string) => {
		if (!text.trim() || isLoading) return;
		void sendMessage({ text });
	};

	const handleSubmit = async () => {
		if (!input.trim() && !pendingImage && !pendingLocation) return;
		if (isLoading) return;

		const textToSubmit = input;
		const imageToSend = pendingImage;
		const locationToSend = pendingLocation;

		setInput("");
		setPendingImage(null);
		setPendingLocation(null);
		if (pendingImage?.preview) URL.revokeObjectURL(pendingImage.preview);

		type MessagePart =
			| { type: "text"; text: string }
			| { type: "file"; mediaType: string; url: string }
			| LocationPart
			| CommutePart;

		const parts: MessagePart[] = [];
		if (textToSubmit.trim()) parts.push({ type: "text", text: textToSubmit });
		if (imageToSend)
			parts.push({ type: "file", mediaType: imageToSend.mimeType, url: imageToSend.url });
		if (locationToSend) parts.push(locationToSend);

		if (parts.length === 0) return;

		try {
			await sendMessage(
				{ parts } as any,
				{ body: { conversationId: activeConversationIdRef.current } },
			);
		} catch (err: unknown) {
			// Handle 410 Gone — image already expired by cleanup job
			const errStatus = (err as { status?: number })?.status;
			if (errStatus === 410) {
				toast.error(cc.toasts.imageExpired, { duration: 5000 });
				setPendingImage(null);
			}
		}
	};

	const handleShareLocation = () => {
		if (appConfig.locationMode === "v2") {
			setLocationDialogOpen(true);
			return;
		}
		// v1 — browser geolocation
		if (!navigator.geolocation) {
			toast.error(cc.toasts.geolocationUnsupported);
			return;
		}
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				const { latitude, longitude } = pos.coords;
				const mapsUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
				doSend(`${cc.locationPrefix} ${latitude.toFixed(6)}, ${longitude.toFixed(6)}\n${mapsUrl}`);
			},
			() => toast.error(cc.toasts.geolocationFailed),
			{ timeout: 10000 },
		);
	};

	const isEmpty = !isInitialLoading && messages.length === 0;

	// ── Render ────────────────────────────────────────────────────────────────

	return (
		<div className="flex flex-col flex-1 min-h-0">
			<MessageList
				messages={messages}
				status={status}
				isInitialLoading={isInitialLoading}
				isLoadingMore={isLoadingMore}
				isEmpty={isEmpty}
				scrollContainerRef={scrollContainerRef}
				topRef={topRef}
				bottomRef={bottomRef}
				onSuggestionClick={(s) => {
					doSend(s);
					setInput("");
				}}
				cc={{
					loadingMore: cc.loadingMore,
					emptyHint: appConfig.chatHint ?? cc.emptyHint,
					suggestions: appConfig.chatSuggestions ?? cc.suggestions,
					toolCalling: cc.toolCalling,
					toolDone: cc.toolDone,
				}}
			/>
			<ChatInput
				input={input}
				setInput={setInput}
				onSubmit={handleSubmit}
				isLoading={isLoading}
				pendingImage={pendingImage}
				onClearImage={() => {
					if (pendingImage?.preview) URL.revokeObjectURL(pendingImage.preview);
					setPendingImage(null);
				}}
				pendingLocation={pendingLocation}
				onClearLocation={() => setPendingLocation(null)}
				onImageUploaded={(result) => setPendingImage(result)}
				onShareLocation={handleShareLocation}
				cc={{
					inputPlaceholder: cc.inputPlaceholder,
					locationLabel: cc.locationLabel,
				}}
			/>
			<LocationDialog
				open={locationDialogOpen}
				onClose={() => setLocationDialogOpen(false)}
				onConfirmLocation={(part) => setPendingLocation(part)}
				onConfirmCommute={(part) => setPendingLocation(part)}
			/>
		</div>
	);
}
