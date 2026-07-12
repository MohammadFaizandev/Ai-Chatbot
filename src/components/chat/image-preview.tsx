"use client";

import { Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export type PendingImage = {
  /** Local object URL for instant preview (revoked after use). */
  previewUrl: string;
  fileName: string;
  /** Set once the upload + registration completed. */
  attachmentId: string | null;
  isUploading: boolean;
};

export function ImagePreview({
  image,
  onRemove,
  disabled,
}: {
  image: PendingImage;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative inline-block">
      {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
      <img
        src={image.previewUrl}
        alt={`Preview of ${image.fileName}`}
        className="h-20 w-20 rounded-md border object-cover"
      />
      {image.isUploading && (
        <div
          className="absolute inset-0 flex items-center justify-center rounded-md bg-black/40"
          role="status"
          aria-label="Uploading image"
        >
          <Loader2 className="size-5 animate-spin text-white motion-reduce:animate-none" />
        </div>
      )}
      <Button
        type="button"
        variant="secondary"
        size="icon-xs"
        className="absolute -top-2 -right-2 rounded-full shadow"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remove image ${image.fileName}`}
      >
        <X className="size-3" />
      </Button>
    </div>
  );
}
