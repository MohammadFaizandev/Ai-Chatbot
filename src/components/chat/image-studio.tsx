"use client";

import { Download, ImageIcon, Sparkles } from "lucide-react";
import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { toast } from "sonner";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { IMAGE_PROMPT_MAX_LENGTH } from "@/lib/validation";

const EXAMPLE_PROMPTS = [
  "A cozy reading nook by a rainy window, warm light, cinematic",
  "A minimalist red robot mascot logo on a dark background",
  "An astronaut planting a flag on a candy-colored planet, 3D render",
  "A neon cyberpunk street market at night, ultra detailed",
] as const;

export function ImageStudio() {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [shownPrompt, setShownPrompt] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  // Track the active object URL so it can be revoked before the next one.
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const trimmed = prompt.trim();
  const canGenerate = !isGenerating && trimmed.length > 0;

  const generate = async () => {
    if (!canGenerate) return;
    setIsGenerating(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        toast.error(body?.error ?? "Could not generate the image.");
        return;
      }

      const blob = await response.blob();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      setImageUrl(url);
      setShownPrompt(trimmed);
    } catch (error) {
      const aborted =
        controller.signal.aborted ||
        (error instanceof Error && error.name === "AbortError");
      if (!aborted) {
        toast.error("Connection lost while generating. Please try again.");
      }
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  };

  const handleSubmit = (event?: FormEvent) => {
    event?.preventDefault();
    void generate();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const download = () => {
    if (!imageUrl) return;
    const link = document.createElement("a");
    link.href = imageUrl;
    const slug =
      shownPrompt
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || "image";
    link.download = `pulse-ai-${slug}.jpg`;
    link.click();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="hidden h-12 shrink-0 items-center gap-2 border-b px-4 md:flex">
        <ImageIcon className="size-4" aria-hidden="true" />
        <h1 className="text-sm font-semibold">Create image</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-8">
          {isGenerating ? (
            <div className="bg-muted flex aspect-square w-full max-w-md animate-pulse items-center justify-center rounded-2xl">
              <Sparkles
                className="text-muted-foreground size-8 motion-safe:animate-bounce"
                aria-hidden="true"
              />
              <span className="sr-only">Generating image…</span>
            </div>
          ) : imageUrl ? (
            <figure className="w-full max-w-md">
              <div className="bg-muted overflow-hidden rounded-2xl border">
                <Image
                  src={imageUrl}
                  alt={shownPrompt}
                  width={1024}
                  height={1024}
                  unoptimized
                  className="h-auto w-full"
                />
              </div>
              <figcaption className="text-muted-foreground mt-2 flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{shownPrompt}</span>
                <Button variant="outline" size="sm" onClick={download}>
                  <Download className="size-4" aria-hidden="true" />
                  Download
                </Button>
              </figcaption>
            </figure>
          ) : (
            <div className="flex flex-col items-center py-16 text-center">
              <BrandLogo className="size-16 rounded-2xl" />
              <h2 className="mt-6 text-xl font-semibold tracking-tight">
                Generate an image
              </h2>
              <p className="text-muted-foreground mt-2 max-w-sm text-sm">
                Describe anything and Pulse AI will create it. Free, no limits
                on creativity.
              </p>
              <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
                {EXAMPLE_PROMPTS.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setPrompt(example)}
                    className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring/50 rounded-lg border px-3 py-2.5 text-left text-sm outline-none focus-visible:ring-2"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-background border-t p-3 sm:p-4"
        aria-label="Image prompt"
      >
        <div className="bg-muted/40 focus-within:ring-ring/50 mx-auto flex w-full max-w-2xl items-end gap-1.5 rounded-xl border p-2 focus-within:ring-2">
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            maxLength={IMAGE_PROMPT_MAX_LENGTH}
            placeholder="Describe the image to create… (Enter to generate)"
            aria-label="Image prompt"
            disabled={isGenerating}
            className="max-h-40 min-h-9 flex-1 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          <Button type="submit" size="sm" disabled={!canGenerate}>
            <Sparkles className="size-4" aria-hidden="true" />
            {isGenerating ? "Generating…" : "Generate"}
          </Button>
        </div>
        <p className="text-muted-foreground mx-auto mt-1.5 w-full max-w-2xl px-1 text-xs">
          Powered by Pollinations — free image generation.
        </p>
      </form>
    </div>
  );
}
