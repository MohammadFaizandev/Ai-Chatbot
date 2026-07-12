"use client";

import { ImageOff } from "lucide-react";
import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import type { AttachmentMeta } from "@/types/chat";

/**
 * Displays a stored private image by requesting a short-lived signed URL.
 * The URL is fetched on demand and never persisted.
 */
export function AttachmentImage({ attachment }: { attachment: AttachmentMeta }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/attachments/${attachment.id}`)
      .then((response) =>
        response.ok ? response.json() : Promise.reject(new Error()),
      )
      .then((body: { url: string }) => {
        if (!cancelled) setUrl(body.url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attachment.id]);

  if (failed) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 rounded-md border p-2 text-xs">
        <ImageOff className="size-4" aria-hidden="true" />
        Image unavailable
      </div>
    );
  }

  if (!url) {
    return <Skeleton className="h-40 w-56 rounded-md" />;
  }

  return (
    // Signed, short-lived Supabase URL; next/image optimization would cache it.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={`Attached image: ${attachment.file_name}`}
      className="max-h-64 max-w-full rounded-md border object-contain"
    />
  );
}
