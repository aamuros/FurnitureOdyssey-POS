"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ReportRangePreset } from "@/lib/reporting/date-range";

type ReportDateRangeFilterProps = {
  pathname?: string;
  currentRange: ReportRangePreset;
  from?: string;
  to?: string;
  preserveParams?: Record<string, string | undefined>;
  summary?: string;
};

const rangeOptions: Array<{ value: ReportRangePreset; label: string }> = [
  { value: "today", label: "Today" },
  { value: "week", label: "Week" },
  { value: "month", label: "Monthly" },
  { value: "custom", label: "Custom" }
];

export function ReportDateRangeFilter({
  pathname,
  currentRange,
  from,
  to,
  preserveParams = {},
  summary
}: ReportDateRangeFilterProps) {
  const router = useRouter();
  const currentPathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [range, setRange] = useState<ReportRangePreset>(currentRange);
  const [fromInput, setFromInput] = useState(from ?? "");
  const [toInput, setToInput] = useState(to ?? "");
  const targetPathname = pathname ?? currentPathname;

  useEffect(() => {
    setRange(currentRange);
    setFromInput(from ?? "");
    setToInput(to ?? "");
  }, [currentRange, from, to]);

  const preservedEntries = useMemo(
    () => Object.entries(preserveParams).filter(([, value]) => value),
    [preserveParams]
  );

  function replaceRange(nextRange: ReportRangePreset, nextFrom?: string, nextTo?: string) {
    const params = new URLSearchParams(searchParams.toString());

    params.delete("page");
    params.delete("staffId");
    params.delete("q");
    params.delete("status");
    params.delete("paymentStatus");
    params.delete("deliveryStatus");
    params.delete("hasBalance");
    params.delete("overdueOnly");

    for (const [key, value] of preservedEntries) {
      if (value && key !== "page") {
        params.set(key, value);
      }
    }

    params.set("range", nextRange);

    if (nextRange === "custom") {
      params.set("from", nextFrom ?? "");
      params.set("to", nextTo ?? "");
    } else {
      params.delete("from");
      params.delete("to");
    }

    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${targetPathname}?${query}` : targetPathname, { scroll: false });
    });
  }

  function selectRange(nextRange: ReportRangePreset) {
    setRange(nextRange);

    if (nextRange !== "custom") {
      replaceRange(nextRange);
    }
  }

  function applyCustom() {
    setRange("custom");
    replaceRange("custom", fromInput, toInput);
  }

  return (
    <section
      className={cn(
        "mb-5 space-y-3 rounded-lg border border-border bg-panel p-3 sm:p-4",
        isPending && "transition-opacity"
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="flex flex-wrap gap-2" aria-label="Report date range">
          {rangeOptions.map((option) => {
            const active = range === option.value;

            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => selectRange(option.value)}
                className={cn(
                  "inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                  active
                    ? "border-border bg-soft-accent/70 text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/35 hover:text-foreground"
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {range === "custom" ? (
          <div className="grid flex-1 gap-2 sm:grid-cols-[minmax(150px,180px)_minmax(150px,180px)_auto]">
            <label className="space-y-1 text-xs font-semibold text-muted-foreground">
              Start date
              <Input
                type="date"
                value={fromInput}
                onChange={(event) => setFromInput(event.target.value)}
                aria-label="Start date"
              />
            </label>
            <label className="space-y-1 text-xs font-semibold text-muted-foreground">
              End date
              <Input
                type="date"
                value={toInput}
                onChange={(event) => setToInput(event.target.value)}
                aria-label="End date"
              />
            </label>
            <Button type="button" variant="secondary" className="self-end px-4" onClick={applyCustom}>
              Apply
            </Button>
          </div>
        ) : null}
      </div>
      {summary ? <p className="text-xs text-muted-foreground">{summary}</p> : null}
    </section>
  );
}
