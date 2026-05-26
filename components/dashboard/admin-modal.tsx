"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

type AdminModalProps = {
  children: ReactNode;
  className?: string;
  panelClassName?: string;
  labelledBy?: string;
  describedBy?: string;
  onBackdropMouseDown?: () => void;
};

let bodyScrollLockCount = 0;
let previousBodyOverflow = "";

function useBodyScrollLock() {
  useEffect(() => {
    if (bodyScrollLockCount === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }

    bodyScrollLockCount += 1;

    return () => {
      bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);

      if (bodyScrollLockCount === 0) {
        document.body.style.overflow = previousBodyOverflow;
      }
    };
  }, []);
}

export function AdminModal({
  children,
  className,
  panelClassName,
  labelledBy,
  describedBy,
  onBackdropMouseDown
}: AdminModalProps) {
  const [mounted, setMounted] = useState(false);
  useBodyScrollLock();

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
