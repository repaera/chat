// src/components/chat/ImageUploadButton.tsx

"use client";

import { Image } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { useLocale } from "@/components/providers/LocaleProvider";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES } from "@/lib/schemas";

type FileReady = {
	rawUrl: string; // object URL for the original file — used in crop dialog
	mimeType: string;
};

type Props = {
	onFileReady: (result: FileReady) => void;
	disabled?: boolean;
	asMenuItem?: boolean;
};

export function ImageUploadButton({
	onFileReady,
	disabled,
	asMenuItem,
}: Props) {
	const { t } = useLocale();
	const iu = t.imageUpload;

	const inputRef = useRef<HTMLInputElement>(null);

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!inputRef.current) return;
		inputRef.current.value = ""; // reset so the same file can be re-selected

		if (!file) return;

		// Client-side validation (server also validates — this is for faster UX)
		if (
			!ALLOWED_IMAGE_TYPES.includes(
				file.type as (typeof ALLOWED_IMAGE_TYPES)[number],
			)
		) {
			toast.error(iu.errors.unsupportedFormat);
			return;
		}
		if (file.size > MAX_IMAGE_SIZE_BYTES) {
			toast.error(
				iu.errors.fileTooLarge.replace(
					"{mb}",
					String(MAX_IMAGE_SIZE_BYTES / 1024 / 1024),
				),
			);
			return;
		}

		const rawUrl = URL.createObjectURL(file);
		onFileReady({ rawUrl, mimeType: file.type });
	};

	if (asMenuItem) {
		return (
			<>
				<Button
					type="button"
					variant="ghost"
					disabled={disabled}
					onClick={() => inputRef.current?.click()}
					className="w-full justify-start gap-2.5 px-3 py-2 h-auto text-sm rounded-lg"
				>
					<Image className="w-5 h-5" />
					{iu.menuLabel}
				</Button>
				<input
					ref={inputRef}
					type="file"
					accept={ALLOWED_IMAGE_TYPES.join(",")}
					className="hidden"
					onChange={handleFileChange}
				/>
			</>
		);
	}

	return (
		<TooltipProvider delayDuration={300}>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={disabled}
						onClick={() => inputRef.current?.click()}
						className="shrink-0 h-10 w-10 rounded-xl p-0"
						aria-label={iu.ariaLabel}
					>
						<span className="text-base">
							<Image className="w-5 h-5" />
						</span>
					</Button>
				</TooltipTrigger>
				<TooltipContent side="top" className="text-xs">
					{iu.tooltip}
				</TooltipContent>
			</Tooltip>

			<input
				ref={inputRef}
				type="file"
				accept={ALLOWED_IMAGE_TYPES.join(",")}
				className="hidden"
				onChange={handleFileChange}
			/>
		</TooltipProvider>
	);
}
