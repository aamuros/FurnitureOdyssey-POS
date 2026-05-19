import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" &&
          "border border-primary/30 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        variant === "secondary" &&
          "border border-border bg-soft-accent/70 text-foreground shadow-sm hover:bg-soft-accent",
        variant === "ghost" && "text-foreground hover:bg-muted/60",
        variant === "danger" && "border border-danger/30 bg-danger text-white shadow-sm hover:bg-danger/90",
        className
      )}
      {...props}
    />
  );
}
