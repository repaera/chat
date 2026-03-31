// src/components/chat/MessageList.tsx
"use client";

import type { UIMessage } from "ai";
import Linkify from "linkify-react";
import { Bot } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
	CommuteBubble,
	LocationBubble,
} from "@/components/chat/LocationBubble";
import type {
	CommutePart,
	LocationPart,
} from "@/components/chat/location-types";
import { TypedText } from "@/components/chat/TypedText";
import { Button } from "@/components/ui/button";

// ── Image with blur-to-sharp transition ────────────────────────────────────
function ChatImage({ src }: { src: string }) {
	const [loaded, setLoaded] = useState(false);
	const imgRef = useRef<HTMLImageElement>(null);

	useEffect(() => {
		if (imgRef.current?.complete) setLoaded(true);
	}, [src]);

	return (
		<div className="mt-1.5 w-full aspect-square rounded-lg overflow-hidden border border-border">
			<img
				ref={imgRef}
				src={src}
				alt="img"
				loading="lazy"
				onLoad={() => setLoaded(true)}
				className={`
          w-full h-full object-cover
          transition-[filter,opacity] duration-500 ease-out
          ${loaded ? "blur-0 opacity-100" : "blur-md opacity-60"}
        `}
			/>
		</div>
	);
}

// ── LLM image card with skeleton placeholder ───────────────────────────────
function MarkdownImage({ src, alt }: { src?: string | Blob; alt?: string }) {
	const [loaded, setLoaded] = useState(false);
	const [errored, setErrored] = useState(false);
	if (!src || typeof src !== "string") return null;
	if (errored) {
		return (
			<a
				href={src}
				target="_blank"
				rel="noopener noreferrer"
				className="underline break-all text-sm"
			>
				{alt || src}
			</a>
		);
	}
	return (
		<a
			href={src}
			target="_blank"
			rel="noopener noreferrer"
			className="block my-1.5"
		>
			<div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border">
				{!loaded && (
					<div className="absolute inset-0 bg-muted animate-pulse rounded-xl" />
				)}
				<img
					src={src}
					alt={alt ?? ""}
					loading="lazy"
					onLoad={() => setLoaded(true)}
					onError={() => setErrored(true)}
					className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
				/>
			</div>
		</a>
	);
}

// ── Skeleton bubble for initial loading ────────────────────────────────────
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
				className="rounded-2xl px-3.5 py-2.5 flex flex-col gap-2 bg-muted"
				style={{ width, minWidth: "60px" }}
			>
				{Array.from({ length: lines }).map((_, i) => (
					<div
						key={i}
						className="h-3 rounded animate-pulse bg-muted-foreground/20"
						style={{ width: i === lines - 1 && lines > 1 ? "65%" : "100%" }}
					/>
				))}
			</div>
		</div>
	);
}

// ── Types ─────────────────────────────────────────────────────────────────
type Locale = {
	loadingMore: string;
	emptyHint: string;
	suggestions: string[];
	toolCalling: string;
	toolDone: string;
};

type Props = {
	messages: UIMessage[];
	status: string;
	isInitialLoading: boolean;
	isLoadingMore: boolean;
	isEmpty: boolean;
	scrollContainerRef: React.RefObject<HTMLDivElement | null>;
	topRef: React.RefObject<HTMLDivElement | null>;
	bottomRef: React.RefObject<HTMLDivElement | null>;
	onSuggestionClick: (s: string) => void;
	cc: Locale;
};

// ── MessageList ────────────────────────────────────────────────────────────
export function MessageList({
	messages,
	status,
	isInitialLoading,
	isLoadingMore,
	isEmpty,
	scrollContainerRef,
	topRef,
	bottomRef,
	onSuggestionClick,
	cc,
}: Props) {
	// Track which message to animate with TypedText after streaming completes.
	// Done synchronously in render (via ref) to avoid the async setState gap that
	// causes a flicker: streamed text visible → disappears → TypedText retypes.
	const prevStatusRef = useRef(status);
	const animateMessageIdRef = useRef<string | null>(null);

	if (prevStatusRef.current !== "ready" && status === "ready") {
		const lastMsg = [...messages].reverse().find((m) => m.role === "assistant");
		animateMessageIdRef.current = lastMsg?.id ?? null;
	}
	prevStatusRef.current = status;

	const animateMessageId = animateMessageIdRef.current;
	const [animationDoneId, setAnimationDoneId] = useState<string | null>(null);

	const isStreaming = status === "streaming" || status === "submitted";

	// The last assistant message ID — hidden during streaming so it never flashes
	// before TypedText takes over.
	const lastAssistantId = [...messages]
		.reverse()
		.find((m) => m.role === "assistant")?.id;

	return (
		<div
			ref={scrollContainerRef}
			className="flex-1 overflow-y-auto overscroll-y-none"
		>
			<div className="min-h-full flex flex-col justify-end px-4 pt-6 pb-6">
				<div className="max-w-2xl mx-auto w-full flex flex-col gap-6">
					<div ref={topRef} className="h-1 shrink-0" />

					{/* Skeleton during initial load */}
					{isInitialLoading && (
						<>
							<SkeletonBubble role="assistant" lines={2} width="70%" />
							<SkeletonBubble role="user" lines={1} width="40%" />
							<SkeletonBubble role="assistant" lines={3} width="80%" />
							<SkeletonBubble role="user" lines={1} width="55%" />
							<SkeletonBubble role="assistant" lines={2} width="65%" />
						</>
					)}

					{isLoadingMore && (
						<div className="flex justify-center py-2">
							<span className="text-xs text-muted-foreground animate-pulse">
								{cc.loadingMore}
							</span>
						</div>
					)}

					{/* Empty state */}
					{isEmpty && (
						<div className="flex flex-col items-center justify-center gap-6 text-center py-16">
							<p className="text-sm text-muted-foreground">{cc.emptyHint}</p>
							<div className="flex flex-col gap-2 w-full max-w-xs">
								{cc.suggestions.map((s) => (
									<Button
										key={s}
										variant="outline"
										onClick={() => onSuggestionClick(s)}
										className="text-sm text-left h-auto px-4 py-2.5 rounded-xl justify-start whitespace-normal"
									>
										{s}
									</Button>
								))}
							</div>
						</div>
					)}

					{/* Messages list */}
					{messages.map((m) => {
						const hasText = (m.parts ?? []).some(
							(p) =>
								p.type === "text" &&
								(p as { type: "text"; text: string }).text.length > 0,
						);
						if (m.role === "assistant" && !hasText) return null;

						// Hide the last assistant message while streaming — TypedText will
						// animate it in cleanly once streaming completes, with no flicker.
						if (
							status === "streaming" &&
							m.id === lastAssistantId &&
							m.role === "assistant"
						)
							return null;

						return (
							<div
								key={m.id}
								className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
							>
								{m.role === "assistant" && (
									<div className="shrink-0 w-7 h-7 rounded-lg bg-muted flex items-center justify-center mt-0.5">
										<Bot className="w-4 h-4 text-muted-foreground" />
									</div>
								)}
								<div
									className={`flex flex-col gap-1.5 min-w-0 overflow-hidden ${m.role === "user" ? "items-end max-w-[65vw] sm:max-w-xs" : "items-start max-w-[75vw] sm:max-w-lg"}`}
								>
									{/* Location / Commute bubbles */}
									{(m.parts ?? [])
										.filter(
											(p) =>
												(p as any).type === "location" ||
												(p as any).type === "commute",
										)
										.map((part, i) => {
											const anyPart = part as any;
											if (anyPart.type === "location") {
												return (
													<div key={`loc-${i}`} className="w-48">
														<LocationBubble part={anyPart as LocationPart} />
													</div>
												);
											}
											if (anyPart.type === "commute") {
												return (
													<div key={`cmt-${i}`} className="w-48">
														<CommuteBubble part={anyPart as CommutePart} />
													</div>
												);
											}
											return null;
										})}

									<div
										className={`
                      inline-flex flex-col rounded-2xl px-2.5 py-1 text-sm space-y-1.5
                      wrap-break-word min-w-0
                      ${
												m.role === "user"
													? "max-w-xs bg-muted text-foreground rounded-br-sm"
													: "w-full bg-background text-foreground"
											}
                    `}
									>
										{/* Images first */}
										{(m.parts ?? [])
											.filter((p) => p.type === "file")
											.map((part, i) => {
												const filePart = part as {
													type: "file";
													mediaType: string;
													url: string;
												};
												if (!filePart.mediaType.startsWith("image/"))
													return null;
												return (
													<a
														key={`img-${i}`}
														href={filePart.url}
														target="_blank"
														rel="noopener noreferrer"
														className="block"
													>
														<ChatImage src={filePart.url} />
													</a>
												);
											})}

										{/* Text */}
										{(m.parts ?? [])
											.filter((p) => p.type === "text")
											.map((part, i) => {
												const textPart = part as { type: "text"; text: string };
												if (!textPart.text) return null;
												const isUser = m.role === "user";
												const shouldAnimate =
													!isUser &&
													i === 0 &&
													m.id === animateMessageId &&
													m.id !== animationDoneId;

												// User messages: plain text with linkify
												if (isUser) {
													return (
														<p
															key={`txt-${i}`}
															className="whitespace-pre-wrap leading-relaxed"
														>
															<Linkify
																options={{
																	target: "_blank",
																	rel: "noopener noreferrer",
																	className:
																		"underline underline-offset-2 hover:opacity-80",
																}}
															>
																{textPart.text}
															</Linkify>
														</p>
													);
												}

												// Assistant messages: TypedText during animation, react-markdown after
												if (shouldAnimate) {
													return (
														<p
															key={`txt-${i}`}
															className="whitespace-pre-wrap leading-relaxed"
														>
															<TypedText
																text={textPart.text}
																typeSpeed={5}
																onComplete={() => setAnimationDoneId(m.id)}
															/>
														</p>
													);
												}

												return (
													<div
														key={`txt-${i}`}
														className="prose prose-sm prose-neutral max-w-none leading-relaxed [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ol]:my-2 [&_pre]:rounded-lg [&_code]:text-xs"
													>
														<ReactMarkdown
															remarkPlugins={[remarkGfm]}
															components={{
																img: MarkdownImage,
																a: ({ href, children }) => (
																	<a
																		href={href}
																		target="_blank"
																		rel="noopener noreferrer"
																		className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
																	>
																		{children}
																	</a>
																),
																table: ({ children }) => (
																	<div className="overflow-x-auto my-2 w-full">
																		<table className="w-full border-collapse border border-border text-sm">
																			{children}
																		</table>
																	</div>
																),
																thead: ({ children }) => (
																	<thead className="bg-muted">{children}</thead>
																),
																th: ({ children }) => (
																	<th className="border border-border px-2 py-1 text-left font-semibold">
																		{children}
																	</th>
																),
																td: ({ children }) => (
																	<td className="border border-border px-2 py-1">
																		{children}
																	</td>
																),
															}}
														>
															{textPart.text}
														</ReactMarkdown>
													</div>
												);
											})}

										{/* Tool parts */}
										{(m.parts ?? [])
											.filter((p) => p.type.startsWith("tool-"))
											.map((part, i) => {
												const toolPart = part as {
													type: string;
													state: "input" | "output" | "error";
													toolName?: string;
												};
												const running = toolPart.state === "input";
												const toolName =
													toolPart.toolName ?? part.type.replace("tool-", "");
												return (
													<p
														key={`tool-${i}`}
														className="text-xs text-muted-foreground italic flex items-center gap-1.5"
													>
														<span
															className={
																running ? "animate-spin inline-block" : ""
															}
														>
															⚙
														</span>
														{running
															? `${cc.toolCalling} ${toolName}…`
															: `${cc.toolDone} ${toolName}`}
													</p>
												);
											})}
									</div>
								</div>
							</div>
						);
					})}

					{/* Bouncing dots — show while the AI is working (submitted + entire streaming duration) */}
					{isStreaming && (
						<div className="flex gap-3 justify-start">
							<div className="shrink-0 w-7 h-7 rounded-lg bg-muted flex items-center justify-center mt-0.5">
								<Bot className="w-4 h-4 text-muted-foreground" />
							</div>
							<div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
								<span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
								<span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
								<span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
							</div>
						</div>
					)}

					<div ref={bottomRef} />
				</div>
			</div>
		</div>
	);
}
