"use client";

import { useCallback, useEffect, useState } from "react";
import type { Area } from "react-easy-crop";
import Cropper from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cropImage } from "@/lib/crop-image";

type Props = {
	open: boolean;
	imageSrc: string;
	onClose: () => void;
	onConfirm: (blob: Blob) => void;
	title: string;
	applyLabel: string;
	cancelLabel: string;
};

export function ImageCropDialog({
	open,
	imageSrc,
	onClose,
	onConfirm,
	title,
	applyLabel,
	cancelLabel,
}: Props) {
	const [crop, setCrop] = useState({ x: 0, y: 0 });
	const [zoom, setZoom] = useState(1);
	const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
	const [isProcessing, setIsProcessing] = useState(false);

	// Reset state each time the dialog opens
	useEffect(() => {
		if (open) {
			setCrop({ x: 0, y: 0 });
			setZoom(1);
			setCroppedAreaPixels(null);
		}
	}, [open]);

	const onCropComplete = useCallback((_: Area, pixels: Area) => {
		setCroppedAreaPixels(pixels);
	}, []);

	const handleConfirm = async () => {
		if (!croppedAreaPixels || isProcessing) return;
		setIsProcessing(true);
		try {
			const blob = await cropImage(imageSrc, croppedAreaPixels);
			onConfirm(blob);
		} finally {
			setIsProcessing(false);
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				if (!v && !isProcessing) onClose();
			}}
		>
			<DialogContent className="max-w-sm w-[calc(100%-2rem)] gap-0 p-0 overflow-hidden [&>button]:hidden">
				{/* Header: title left, cancel right — replaces the default close button */}
				<div className="flex items-center justify-between px-4 py-2">
					<DialogTitle>{title}</DialogTitle>
					<Button
						variant="outline"
						size="sm"
						onClick={onClose}
						disabled={isProcessing}
						className="h-8 px-3 text-sm"
					>
						{cancelLabel}
					</Button>
				</div>
				{/* Crop area — fixed 1:1. Pinch to zoom, drag to reposition. */}
				<div className="relative w-full aspect-square bg-black">
					<Cropper
						image={imageSrc}
						crop={crop}
						zoom={zoom}
						aspect={1}
						onCropChange={setCrop}
						onZoomChange={setZoom}
						onCropComplete={onCropComplete}
					/>
				</div>
				<div className="px-4 py-3">
					<Button
						onClick={handleConfirm}
						disabled={isProcessing}
						className="w-full"
					>
						{applyLabel}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
