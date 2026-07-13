"use client";

import { Check, ChevronDown, Cpu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CHAT_MODELS, getChatModel } from "@/lib/models";
import { cn } from "@/lib/utils";

/** Compact dropdown to choose the active chat model. */
export function ModelPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const current = getChatModel(value) ?? CHAT_MODELS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            aria-label={`Model: ${current.label}. Change model`}
          />
        }
      >
        <Cpu className="size-4" aria-hidden="true" />
        <span className="max-w-32 truncate">{current.label}</span>
        <ChevronDown className="size-3.5 opacity-60" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Model</DropdownMenuLabel>
          {CHAT_MODELS.map((model) => (
            <DropdownMenuItem
              key={model.id}
              onClick={() => onChange(model.id)}
              className="flex-col items-start gap-0.5 py-2"
            >
              <span className="flex w-full items-center gap-2 font-medium">
                {model.label}
                <Check
                  className={cn(
                    "ml-auto size-4",
                    model.id === value ? "opacity-100" : "opacity-0",
                  )}
                  aria-hidden="true"
                />
              </span>
              <span className="text-muted-foreground text-xs">
                {model.description}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
