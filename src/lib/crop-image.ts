// Canvas-based image crop utility. Produces a JPEG blob from a pixel crop area.

import type { Area } from "react-easy-crop";

export async function cropImage(imageSrc: string, pixelCrop: Area): Promise<Blob> {
	const image = await loadImage(imageSrc);
	const canvas = document.createElement("canvas");
	canvas.width = pixelCrop.width;
	canvas.height = pixelCrop.height;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Could not get canvas context");
	ctx.drawImage(
		image,
		pixelCrop.x,
		pixelCrop.y,
		pixelCrop.width,
		pixelCrop.height,
		0,
		0,
		pixelCrop.width,
		pixelCrop.height,
	);
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (blob) resolve(blob);
				else reject(new Error("Failed to create blob from canvas"));
			},
			"image/jpeg",
			0.9,
		);
	});
}

function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.addEventListener("load", () => resolve(img));
		img.addEventListener("error", (e) => reject(e));
		img.src = src;
	});
}
