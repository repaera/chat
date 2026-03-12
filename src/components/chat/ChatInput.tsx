// src/components/chat/ChatInput.tsx
"use client";

import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ImageUploadButton } from "@/components/chat/ImageUploadButton";
import { Plus, ArrowUp, MapPin, X } from "lucide-react";
import type { LocationAttachment } from "@/components/chat/location-types";

// ── Types ──────────────────────────────────────────────────────────────────

export type PendingImage = {
	url: string;
	key: string;
	imageId: string;
	preview: string;
	mimeType: string;
};

type Locale = {
	inputPlaceholder: string;
	locationLabel: string;
};

type Props = {
	input: string;
	setInput: (v: string) => void;
	onSubmit: () => void;
	isLoading: boolean;
	pendingImage: PendingImage | null;
	onClearImage: () => void;
	pendingLocation: LocationAttachment | null;
	onClearLocation: () => void;
	onImageUploaded: (result: PendingImage) => void;
	onShareLocation: () => void;
	cc: Locale;
};

// ── ChatInput ──────────────────────────────────────────────────────────────

export function ChatInput({
	input,
	setInput,
	onSubmit,
	isLoading,
	pendingImage,
	onClearImage,
	pendingLocation,
	onClearLocation,
	onImageUploaded,
	onShareLocation,
	cc,
}: Props) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [attachMenuOpen, setAttachMenuOpen] = useState(false);

	// Reset textarea height when input is cleared after submit
	useEffect(() => {
		if (input === "" && textareaRef.current) {
			textareaRef.current.style.height = "auto";
		}
	}, [input]);

	const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setInput(e.target.value);
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
			textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		const isMobile =
			typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
		if (e.key === "Enter" && !e.shiftKey && !isMobile) {
			e.preventDefault();
			onSubmit();
		}
	};

	const handleShareLocation = () => {
		setAttachMenuOpen(false);
		onShareLocation();
	};

	return (
		<div className="px-4 pb-6 pt-2 shrink-0 flex justify-center sticky bottom-0 bg-white backdrop-blur-md">
			<div className="max-w-2xl w-full rounded-2xl shadow border border-zinc-200 bg-white p-2.5">
				{/* Pending image preview */}
				{pendingImage && (
					<div className="flex items-center gap-2 px-0.5 pb-1.5">
						<div className="relative w-14 h-14 shrink-0">
							<img
								src={pendingImage.preview}
								alt="Preview"
								className="w-14 h-14 rounded-lg object-cover border border-transparent"
							/>
							<button
								type="button"
								onClick={onClearImage}
								className="absolute -top-1 -right-1 rounded-full bg-zinc-800 text-white text-[10px] flex items-center justify-center align-middle leading-none hover:bg-zinc-700"
							>
								<X className="size-4" />
							</button>
						</div>
					</div>
				)}

				{/* Pending location preview */}
				{pendingLocation && (
					<div className="flex items-center gap-2 px-0.5 pb-1.5">
						<div className="relative flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm max-w-xs">
							{pendingLocation.type === "location" ? (
								<>
									<MapPin className="w-4 h-4 shrink-0 text-zinc-500" />
									<span className="text-xs text-zinc-700 truncate">{pendingLocation.label}</span>
								</>
							) : (
								<>
									<MapPin className="w-4 h-4 shrink-0 text-zinc-500" />
									<span className="text-xs text-zinc-700 truncate">
										{pendingLocation.origin.label} → {pendingLocation.destination.label}
									</span>
								</>
							)}
							<button
								type="button"
								onClick={onClearLocation}
								className="absolute -top-1 -right-1 rounded-full bg-zinc-800 text-white flex items-center justify-center hover:bg-zinc-700"
							>
								<X className="size-4" />
							</button>
						</div>
					</div>
				)}

				<form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-0.5">
					<div>
						<textarea
							ref={textareaRef}
							value={input}
							onChange={handleInput}
							onKeyDown={handleKeyDown}
							placeholder={cc.inputPlaceholder}
							disabled={isLoading}
							rows={1}
							className="
                w-full resize-none rounded-none border-0
                bg-transparent p-0.5 text-sm sm:text-base text-black caret-black
                placeholder:text-zinc-500 focus:outline-none
                disabled:opacity-50 max-h-32 overflow-y-auto leading-relaxed
              "
							style={{ minHeight: "44px" }}
						/>
					</div>
					<div className="flex items-center justify-between">
						{/* Attach dropdown — appears upwards */}
						<div className="relative shrink-0">
							{attachMenuOpen && (
								<>
									<div
										className="fixed inset-0 z-10"
										onClick={() => setAttachMenuOpen(false)}
									/>
									<div className="absolute bottom-full left-0 mb-2 z-20 flex flex-col gap-0.5 rounded-lg border border-zinc-100 bg-white p-1 shadow-sm min-w-[160px]">
										<ImageUploadButton
											asMenuItem
											onUploaded={(result) => {
												onImageUploaded(result);
												setAttachMenuOpen(false);
											}}
											disabled={isLoading || !!pendingImage}
										/>
										<button
											type="button"
											onClick={handleShareLocation}
											disabled={isLoading}
											className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-black hover:bg-zinc-100 disabled:opacity-50 transition-colors w-full"
										>
											<MapPin className="w-5 h-5" />
											{cc.locationLabel}
										</button>
									</div>
								</>
							)}
							<button
								type="button"
								onClick={() => setAttachMenuOpen((v) => !v)}
								disabled={isLoading}
								className="w-10 h-10 rounded-xl bg-zinc-100 hover:bg-zinc-50 text-black flex items-center justify-center transition-all disabled:opacity-50"
							>
								<Plus
									className={`w-5 h-5 transition-transform duration-200 ${attachMenuOpen ? "rotate-45" : "rotate-0"}`}
								/>
							</button>
						</div>

						<Button
							type="submit"
							disabled={isLoading || !input.trim()}
							className="shrink-0 w-10 h-10 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-zinc-100 p-0"
						>
							<ArrowUp className="w-5 h-5" />
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
}
