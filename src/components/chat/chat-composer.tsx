"use client";

import { useAuth } from "@clerk/nextjs";
import { ImagePlus, SendHorizontal, Square } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { toast } from "sonner";

import { ImagePreview, type PendingImage } from "@/components/chat/image-preview";
import { ModelPicker } from "@/components/chat/model-picker";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  CLIENT_MAX_IMAGE_SIZE_MB,
  CLIENT_MAX_MESSAGE_LENGTH,
} from "@/lib/client-config";
import { useSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  extensionForMimeType,
  isSendableMessage,
  validateImageFile,
} from "@/lib/validation";
import type { AttachmentMeta, UsageInfo } from "@/types/chat";

const CHAT_IMAGES_BUCKET = "chat-images";
const MAX_TEXTAREA_HEIGHT_PX = 200;

export function ChatComposer({
  conversationId,
  usage,
  isGenerating,
  onSend,
  onStop,
  model,
  onModelChange,
  initialText = "",
}: {
  conversationId: string;
  usage: UsageInfo;
  isGenerating: boolean;
  onSend: (text: string, attachments: AttachmentMeta[]) => void;
  onStop: () => void;
  model: string;
  onModelChange: (id: string) => void;
  initialText?: string;
}) {
  const { userId } = useAuth();
  const supabase = useSupabaseBrowserClient();
  const [text, setText] = useState(initialText);
  const [image, setImage] = useState<PendingImage | null>(null);
  const attachmentMetaRef = useRef<AttachmentMeta | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Focus the composer when it opens with a prefilled prompt.
  useEffect(() => {
    if (initialText) {
      textareaRef.current?.focus();
    }
  }, [initialText]);

  // Revoke the local preview URL when the component unmounts.
  useEffect(() => {
    return () => {
      if (image?.previewUrl) URL.revokeObjectURL(image.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount only
  }, []);

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [text, resizeTextarea]);

  const limitReached = usage.remaining <= 0;
  const uploading = image?.isUploading ?? false;
  const canSend =
    !isGenerating &&
    !uploading &&
    !limitReached &&
    isSendableMessage(text, image?.attachmentId ? 1 : 0);

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || image) return;

    const validation = validateImageFile(file, CLIENT_MAX_IMAGE_SIZE_MB);
    if (!validation.ok) {
      toast.error(validation.reason);
      return;
    }
    if (!supabase || !userId) {
      toast.error("You must be signed in to attach images.");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setImage({
      previewUrl,
      fileName: file.name,
      attachmentId: null,
      isUploading: true,
    });

    try {
      const extension = extensionForMimeType(file.type);
      const storagePath = `${userId}/${conversationId}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(CHAT_IMAGES_BUCKET)
        .upload(storagePath, file, { contentType: file.type, upsert: false });
      if (uploadError) throw new Error(uploadError.message);

      const response = await fetch("/api/attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          storagePath,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Upload failed.");
      }
      const { attachment } = (await response.json()) as {
        attachment: AttachmentMeta;
      };

      attachmentMetaRef.current = attachment;
      setImage((previous) =>
        previous
          ? { ...previous, attachmentId: attachment.id, isUploading: false }
          : previous,
      );
    } catch (error) {
      URL.revokeObjectURL(previewUrl);
      setImage(null);
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Could not upload the image. Please try again.",
      );
    }
  };

  const handleRemoveImage = async () => {
    if (!image) return;
    const attachmentId = image.attachmentId;
    URL.revokeObjectURL(image.previewUrl);
    setImage(null);
    attachmentMetaRef.current = null;
    if (attachmentId) {
      // Best-effort cleanup of the uploaded-but-unsent image.
      fetch(`/api/attachments/${attachmentId}`, { method: "DELETE" }).catch(
        () => undefined,
      );
    }
  };

  const handleSubmit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!canSend) return;

    const attachments = attachmentMetaRef.current
      ? [attachmentMetaRef.current]
      : [];
    onSend(text.trim(), attachments);

    setText("");
    if (image) URL.revokeObjectURL(image.previewUrl);
    setImage(null);
    attachmentMetaRef.current = null;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const remainingLabel = limitReached
    ? "Daily message limit reached — resets at midnight UTC."
    : `${usage.remaining} of ${usage.limit} messages left today`;

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-background border-t p-3 sm:p-4"
      aria-label="Message composer"
    >
      {image && (
        <div className="mb-2">
          <ImagePreview
            image={image}
            onRemove={handleRemoveImage}
            disabled={isGenerating}
          />
        </div>
      )}

      <div className="bg-muted/40 focus-within:ring-ring/50 flex items-end gap-1.5 rounded-xl border p-2 focus-within:ring-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={handleFileSelected}
          aria-label="Attach an image"
          tabIndex={-1}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isGenerating || uploading || !!image || limitReached}
          aria-label="Attach an image (JPEG, PNG, or WebP)"
        >
          <ImagePlus className="size-4" />
        </Button>

        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={CLIENT_MAX_MESSAGE_LENGTH}
          placeholder={
            limitReached
              ? "Daily limit reached — come back tomorrow"
              : "Ask anything… (Enter to send, Shift+Enter for a new line)"
          }
          disabled={limitReached}
          aria-label="Message"
          className="max-h-[200px] min-h-9 flex-1 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
        />

        {isGenerating ? (
          <Button
            type="button"
            variant="destructive"
            size="icon-sm"
            onClick={onStop}
            aria-label="Stop generating"
          >
            <Square className="size-4" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon-sm"
            disabled={!canSend}
            aria-label="Send message"
          >
            <SendHorizontal className="size-4" />
          </Button>
        )}
      </div>

      <div className="mt-1 flex items-center justify-between gap-2 px-1">
        <ModelPicker
          value={model}
          onChange={onModelChange}
          disabled={isGenerating}
        />
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <span aria-live="polite">{remainingLabel}</span>
          {text.length > CLIENT_MAX_MESSAGE_LENGTH * 0.9 && (
            <span>
              {text.length}/{CLIENT_MAX_MESSAGE_LENGTH}
            </span>
          )}
        </div>
      </div>
    </form>
  );
}
