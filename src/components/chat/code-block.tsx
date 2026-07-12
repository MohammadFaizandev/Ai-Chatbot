"use client";

import { Check, Copy } from "lucide-react";
import {
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";

function extractText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement(node)) {
    return extractText((node.props as { children?: ReactNode }).children);
  }
  return "";
}

function extractLanguage(node: ReactNode): string | null {
  if (!isValidElement(node)) {
    if (Array.isArray(node)) {
      for (const child of node) {
        const language = extractLanguage(child);
        if (language) return language;
      }
    }
    return null;
  }
  const { className } = node.props as { className?: string };
  const match = /language-([\w-]+)/.exec(className ?? "");
  return match ? match[1] : null;
}

/** Fenced code block with a copy button. Content is rendered as plain text. */
export function CodeBlock({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const language = extractLanguage(children);

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(extractText(children).trimEnd());
      setCopied(true);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (permissions/insecure context) — ignore.
    }
  };

  return (
    <div className="group/code bg-background relative my-3 overflow-hidden rounded-lg border">
      <div className="text-muted-foreground flex items-center justify-between border-b px-3 py-1 text-xs">
        <span>{language ?? "code"}</span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleCopy}
          aria-label={copied ? "Copied" : "Copy code"}
        >
          {copied ? (
            <Check className="size-3.5" aria-hidden="true" />
          ) : (
            <Copy className="size-3.5" aria-hidden="true" />
          )}
        </Button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed">
        {children}
      </pre>
    </div>
  );
}
