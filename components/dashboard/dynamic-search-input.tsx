"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type DynamicSearchInputProps = {
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
  resetPageParam?: boolean;
  "aria-label"?: string;
};

export function DynamicSearchInput({
  name = "q",
  defaultValue = "",
  placeholder,
  className,
  debounceMs = 300,
  resetPageParam = true,
  "aria-label": ariaLabel
}: DynamicSearchInputProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const currentValue = searchParams.get(name) ?? "";
  const pendingValueRef = useRef<string | null>(null);
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (pendingValueRef.current === currentValue) {
      pendingValueRef.current = null;
      setValue((currentLocalValue) =>
        currentLocalValue.trim() === currentValue ? currentValue : currentLocalValue
      );
      return;
    }

    setValue(currentValue);
  }, [currentValue]);

  useEffect(() => {
    const normalizedValue = value.trim();

    if (normalizedValue === currentValue) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const nextParams = new URLSearchParams(searchParams.toString());

      if (normalizedValue) {
        nextParams.set(name, normalizedValue);
      } else {
        nextParams.delete(name);
      }

      if (resetPageParam) {
        nextParams.delete("page");
      }

      const queryString = nextParams.toString();
      const href = queryString ? `${pathname}?${queryString}` : pathname;
      pendingValueRef.current = normalizedValue;

      startTransition(() => {
        router.replace(href, { scroll: false });
      });
    }, debounceMs);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [currentValue, debounceMs, name, pathname, resetPageParam, router, searchParams, value]);

  return (
    <Input
      name={name}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
        }
      }}
      placeholder={placeholder}
      aria-label={ariaLabel}
      aria-busy={isPending}
      className={cn(isPending ? "border-primary/60" : undefined, className)}
    />
  );
}
