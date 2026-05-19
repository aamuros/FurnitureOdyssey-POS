import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-lg border border-border bg-panel/90 px-3 py-2 text-sm text-foreground shadow-inner shadow-background/40 outline-none transition placeholder:text-muted-foreground focus:border-primary focus:bg-panel focus:ring-2 focus:ring-primary/20",
        className
      )}
      {...props}
    />
  );
}
