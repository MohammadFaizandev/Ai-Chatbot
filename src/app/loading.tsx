import { Loader2 } from "lucide-react";

export default function RootLoading() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="flex min-h-screen items-center justify-center"
    >
      <Loader2 className="text-muted-foreground size-6 animate-spin motion-reduce:animate-none" />
    </div>
  );
}
