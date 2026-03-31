// src/lib/compress-image.ts
// Compress image on browser before upload using browser-image-compression.
// GIF is excluded — compression would destroy animation.

import imageCompression from "browser-image-compression";

const SKIP_IF_BELOW_KB = 200; // skip compression if already small enough
const MAX_SIZE_MB = 1;
const MAX_DIMENSION_PX = 1920;

export async function compressImage(file: File): Promise<File> {
	// Skip GIF — would destroy animation frames
	if (file.type === "image/gif") return file;

	// Skip if already small enough
	if (file.size <= SKIP_IF_BELOW_KB * 1024) return file;

	return imageCompression(file, {
		maxSizeMB: MAX_SIZE_MB,
		maxWidthOrHeight: MAX_DIMENSION_PX,
		useWebWorker: true, // non-blocking — runs off main thread
		preserveExif: false, // strip EXIF (GPS, camera info, orientation)
		fileType: "image/jpeg",
		initialQuality: 0.8,
	});
}
