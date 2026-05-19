import { cn } from "@/lib/utils";

type StatusPillProps = {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "teal";
};

export function StatusPill({ children, tone = "neutral" }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        tone === "neutral" && "border-border bg-muted/55 text-muted-foreground",
        tone === "success" && "border-success/25 bg-success/15 text-success",
        tone === "warning" && "border-warning/25 bg-soft-accent text-warning",
        tone === "danger" && "border-danger/25 bg-danger/10 text-danger",
        tone === "teal" && "border-primary/25 bg-primary/15 text-primary"
      )}
    >
      {children}
    </span>
  );
}
