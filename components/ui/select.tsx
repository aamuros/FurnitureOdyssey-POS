import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "min-h-10 w-full rounded-lg border border-border bg-panel/90 px-3 text-sm text-foreground shadow-inner shadow-background/40 outline-none transition focus:border-primary focus:bg-panel focus:ring-2 focus:ring-primary/20",
        className
      )}
      {...props}
    />
  );
}
