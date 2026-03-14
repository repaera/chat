// src/components/chat/ImageUploadButton.tsx

"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES } from "@/lib/schemas";
import { CloudUpload, Image } from "lucide-react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { compressImage } from "@/lib/compress-image";

type UploadResult = {
  url: string;
  key: string;
  imageId: string;
  preview: string;  // blob URL for local preview before uploading
  mimeType: string; // used for FileUIPart mediaType in ChatClient
};

type Props = {
  onUploaded: (result: UploadResult) => void;
  disabled?: boolean;
  asMenuItem?: boolean;
};

export function ImageUploadButton({ onUploaded, disabled, asMenuItem }: Props) {
  const { t } = useLocale();
  const iu = t.imageUpload;

  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!inputRef.current) return;
    inputRef.current.value = ""; // reset so the same file can be uploaded again

    if (!file) return;

    // Client-side validation (server also validates — this is for faster UX)
    if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
      toast.error(iu.errors.unsupportedFormat);
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      toast.error(iu.errors.fileTooLarge.replace("{mb}", String(MAX_IMAGE_SIZE_BYTES / 1024 / 1024)));
      return;
    }

    // Create blob URL for a local preview of the original file (before compression)
    const preview = URL.createObjectURL(file);

    setIsUploading(true);
    try {
      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.append("file", compressed);

      const res = await fetch("/api/upload", { method: "POST", body: formData });

      if (res.status === 503) {
        URL.revokeObjectURL(preview);
        toast.error(iu.errors.notConfigured);
        return;
      }
      if (!res.ok) {
        URL.revokeObjectURL(preview);
        const data = await res.json().catch(() => ({}));
        toast.error((data as { error?: string }).error ?? iu.errors.uploadFailed);
        return;
      }

      const data = await res.json() as { url: string; key: string; imageId: string };
      onUploaded({ ...data, preview, mimeType: file.type });
    } catch {
      URL.revokeObjectURL(preview);
      toast.error(iu.errors.uploadFailedRetry);
    } finally {
      setIsUploading(false);
    }
  };

  if (asMenuItem) {
    return (
      <>
        <Button
          type="button"
          variant="ghost"
          disabled={disabled || isUploading}
          onClick={() => inputRef.current?.click()}
          className="w-full justify-start gap-2.5 px-3 py-2 h-auto text-sm rounded-lg"
        >
          {isUploading ? (
            <CloudUpload className="w-5 h-5 animate-slide-up" />
          ) : (
            <Image className="w-5 h-5" />
          )}
          {isUploading ? iu.uploading : iu.menuLabel}
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
            disabled={disabled || isUploading}
            onClick={() => inputRef.current?.click()}
            className="shrink-0 h-10 w-10 rounded-xl p-0"
            aria-label={iu.ariaLabel}
          >
            {isUploading ? (
              <span className="animate-slide-up text-sm"><CloudUpload className="w-5 h-5" /></span>
            ) : (
              <span className="text-base"><Image className="w-5 h-5" /></span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {isUploading ? iu.uploading : iu.tooltip}
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
