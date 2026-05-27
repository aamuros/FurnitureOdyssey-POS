"use client";

import { useEffect } from "react";

type BodyScrollSnapshot = {
  overflow: string;
  position: string;
  top: string;
  width: string;
  scrollY: number;
};

let lockCount = 0;
let snapshot: BodyScrollSnapshot | null = null;

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof window === "undefined") {
      return;
    }

    if (lockCount === 0) {
      snapshot = {
        overflow: document.body.style.overflow,
        position: document.body.style.position,
        top: document.body.style.top,
        width: document.body.style.width,
        scrollY: window.scrollY
      };

      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = `-${snapshot.scrollY}px`;
      document.body.style.width = "100%";
    }

    lockCount += 1;

    return () => {
      lockCount = Math.max(0, lockCount - 1);

      if (lockCount === 0 && snapshot) {
        const scrollY = snapshot.scrollY;
        document.body.style.overflow = snapshot.overflow;
        document.body.style.position = snapshot.position;
        document.body.style.top = snapshot.top;
        document.body.style.width = snapshot.width;
        snapshot = null;
        window.scrollTo(0, scrollY);
      }
    };
  }, [active]);
}
