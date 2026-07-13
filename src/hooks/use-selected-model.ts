"use client";

import { useCallback, useEffect, useState } from "react";

import { DEFAULT_CHAT_MODEL_ID, isSelectableModel } from "@/lib/models";

const STORAGE_KEY = "pulse:model";

/**
 * The user's chosen chat model, persisted to localStorage so it sticks
 * across reloads and conversations. Falls back to the default for any
 * missing or no-longer-valid stored value.
 */
export function useSelectedModel(): [string, (id: string) => void] {
  const [model, setModel] = useState(DEFAULT_CHAT_MODEL_ID);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && isSelectableModel(stored)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore after mount
        setModel(stored);
      }
    } catch {
      // localStorage unavailable — keep the default.
    }
  }, []);

  const select = useCallback((id: string) => {
    setModel(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Best effort only.
    }
  }, []);

  return [model, select];
}
