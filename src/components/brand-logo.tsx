import Image from "next/image";

import { APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * The product mark: the robot logo on its black tile. Works on light and
 * dark surfaces. Size via the `className` (defaults to a header-sized tile).
 */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black",
        className,
      )}
    >
      <Image
        src="/logo.png"
        alt={`${APP_NAME} logo`}
        width={64}
        height={64}
        className="size-full object-contain p-0.5"
        priority
      />
    </span>
  );
}
