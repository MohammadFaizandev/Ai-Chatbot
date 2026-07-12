"use client";

import { useCallback, useEffect, useRef } from "react";

const PINNED_THRESHOLD_PX = 80;

/**
 * Auto-scroll the chat container while content grows, but only when the user
 * is already near the bottom — never fight a user who scrolled up to read.
 */
export function useChatScroll(dependency: unknown) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pinnedRef = useRef(true);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    pinnedRef.current = distanceFromBottom < PINNED_THRESHOLD_PX;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
    pinnedRef.current = true;
  }, []);

  useEffect(() => {
    if (pinnedRef.current) {
      scrollToBottom();
    }
  }, [dependency, scrollToBottom]);

  return { containerRef, handleScroll, scrollToBottom };
}
