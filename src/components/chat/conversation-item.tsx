"use client";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useConversations } from "@/components/chat/conversations-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { CONVERSATION_TITLE_MAX_LENGTH } from "@/lib/validation";
import type { ConversationRow } from "@/types/database";

function formatTimestamp(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function ConversationItem({
  conversation,
  onNavigate,
}: {
  conversation: ConversationRow;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { renameConversation, deleteConversation } = useConversations();
  const isActive = pathname === `/chat/${conversation.id}`;

  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [title, setTitle] = useState(conversation.title);
  const [isBusy, setIsBusy] = useState(false);

  const handleRename = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || isBusy) return;
    setIsBusy(true);
    const ok = await renameConversation(conversation.id, trimmed);
    setIsBusy(false);
    if (ok) setRenameOpen(false);
  };

  const handleDelete = async () => {
    if (isBusy) return;
    setIsBusy(true);
    await deleteConversation(conversation.id);
    setIsBusy(false);
    setDeleteOpen(false);
  };

  return (
    <div
      className={cn(
        "group/item relative flex items-center rounded-md",
        isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
      )}
    >
      <Link
        href={`/chat/${conversation.id}`}
        onClick={onNavigate}
        aria-current={isActive ? "page" : undefined}
        className="focus-visible:ring-ring/50 flex min-w-0 flex-1 flex-col gap-0.5 rounded-md px-2.5 py-2 outline-none focus-visible:ring-2"
      >
        <span className="truncate text-sm font-medium">
          {conversation.title}
        </span>
        <span className="text-muted-foreground text-xs">
          {formatTimestamp(conversation.updated_at)}
        </span>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="mr-1 opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
              aria-label={`Actions for ${conversation.title}`}
            />
          }
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              setTitle(conversation.title);
              setRenameOpen(true);
            }}
          >
            <Pencil className="size-4" aria-hidden="true" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="size-4" aria-hidden="true" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename conversation</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRename} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`rename-${conversation.id}`}>Title</Label>
              <Input
                id={`rename-${conversation.id}`}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={CONVERSATION_TITLE_MAX_LENGTH}
                autoFocus
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isBusy || !title.trim()}>
                {isBusy ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              “{conversation.title}” and all of its messages and images will be
              permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isBusy}
              onClick={handleDelete}
            >
              {isBusy ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
