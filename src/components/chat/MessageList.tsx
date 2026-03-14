// src/components/chat/MessageList.tsx
"use client";

import { useRef, useState, useEffect } from "react";
import type { UIMessage } from "ai";
import { Button } from "@/components/ui/button";
import Linkify from "linkify-react";
import { Bot } from "lucide-react";
import { LocationBubble, CommuteBubble } from "@/components/chat/LocationBubble";
import type { LocationPart, CommutePart } from "@/components/chat/location-types";

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

// ── Skeleton bubble for initial loading ────────────────────────────────────
function SkeletonBubble({
	role,
	lines,
	width,
}: { role: "user" | "assistant"; lines: number; width: string }) {
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
	return (
		<div ref={scrollContainerRef} className="flex-1 overflow-y-auto overscroll-y-none">
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
							<span className="text-xs text-muted-foreground animate-pulse">{cc.loadingMore}</span>
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
							(p) => p.type === "text" && (p as { type: "text"; text: string }).text.length > 0,
						);
						if (m.role === "assistant" && !hasText) return null;

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
											(p) => (p as any).type === "location" || (p as any).type === "commute",
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
                      break-words min-w-0
                      ${
																m.role === "user"
																	? "max-w-xs bg-muted text-foreground rounded-br-sm"
																	: "w-full bg-background border border-border text-foreground rounded-bl-sm"
															}
                    `}
									>
										{/* Images first */}
										{(m.parts ?? []).filter((p) => p.type === "file").map((part, i) => {
											const filePart = part as { type: "file"; mediaType: string; url: string };
											if (!filePart.mediaType.startsWith("image/")) return null;
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
										{(m.parts ?? []).filter((p) => p.type === "text").map((part, i) => {
											const textPart = part as { type: "text"; text: string };
											if (!textPart.text) return null;
											const isUser = m.role === "user";
											return (
												<p key={`txt-${i}`} className="whitespace-pre-wrap leading-relaxed">
													<Linkify
														options={{
															target: "_blank",
															rel: "noopener noreferrer",
															className: isUser
																? "underline underline-offset-2 hover:opacity-80"
																: "text-blue-600 underline underline-offset-2 hover:text-blue-700",
														}}
													>
														{textPart.text}
													</Linkify>
												</p>
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
												const toolName = toolPart.toolName ?? part.type.replace("tool-", "");
												return (
													<p
														key={`tool-${i}`}
														className="text-xs text-muted-foreground italic flex items-center gap-1.5"
													>
														<span className={running ? "animate-spin inline-block" : ""}>⚙</span>
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

					{/* Bouncing dots — show when submitted OR streaming but no text yet */}
					{(status === "submitted" ||
						(status === "streaming" &&
							!messages
								.at(-1)
								?.parts?.some(
									(p) =>
										p.type === "text" &&
										(p as { type: "text"; text: string }).text.length > 0,
								))) && (
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
