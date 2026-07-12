import { Skeleton } from "@/components/ui/skeleton";

export default function ConversationLoading() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      role="status"
      aria-label="Loading conversation"
    >
      <div className="hidden h-12 shrink-0 items-center border-b px-4 md:flex">
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">
        <Skeleton className="ml-auto h-10 w-2/5 rounded-xl" />
        <Skeleton className="h-24 w-3/5 rounded-xl" />
        <Skeleton className="ml-auto h-10 w-1/3 rounded-xl" />
        <Skeleton className="h-16 w-1/2 rounded-xl" />
      </div>
      <div className="border-t p-4">
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    </div>
  );
}
