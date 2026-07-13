import { Cpu } from "lucide-react";

/** Centered in-thread notice that the active model changed. */
export function ModelChangeDivider({ modelLabel }: { modelLabel: string }) {
  return (
    <div className="flex items-center gap-3 py-1" role="separator">
      <span className="bg-border h-px flex-1" />
      <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
        <Cpu className="size-3.5" aria-hidden="true" />
        Now using {modelLabel}
      </span>
      <span className="bg-border h-px flex-1" />
    </div>
  );
}
