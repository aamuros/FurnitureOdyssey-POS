"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { cn } from "@/lib/utils";

type AdminModalProps = {
  children: ReactNode;
  className?: string;
  panelClassName?: string;
  labelledBy?: string;
  describedBy?: string;
  onBackdropMouseDown?: () => void;
};

export function AdminModal({
  children,
  className,
  panelClassName,
  labelledBy,
  describedBy,
  onBackdropMouseDown
}: AdminModalProps) {
  const [mounted, setMounted] = useState(false);
  useBodyScrollLock(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  function handleBackdropMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      onBackdropMouseDown?.();
    }
  }

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[100] flex overflow-hidden bg-foreground/35 p-3 backdrop-blur-sm md:p-6",
        className
      )}
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={panelClassName}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
