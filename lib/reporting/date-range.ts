export type ReportRangePreset = "today" | "week" | "month" | "custom";

export type ReportDateRange = {
  range: ReportRangePreset;
  fromInput: string;
  toInput: string;
  dateRange: { gte?: Date; lte?: Date } | undefined;
  label: string;
};

function manilaDateParts(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((current, part) => {
      if (part.type !== "literal") {
        current[part.type] = part.value;
      }

      return current;
    }, {});
}

function manilaWeekday(date = new Date()) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    weekday: "short"
  }).format(date);

  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
}

function inputValue(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function manilaDate(input: string, endOfDay = false) {
  return new Date(`${input}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+08:00`);
}

function labelDate(input: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila"
  }).format(manilaDate(input));
}

export function parseRangePreset(value: string | undefined): ReportRangePreset {
  return value === "week" || value === "month" || value === "custom" ? value : "today";
}

export function parseDateInput(value: string | undefined, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  const date = manilaDate(value, endOfDay);
  return Number.isNaN(date.getTime()) || inputValue(date) !== value ? undefined : date;
}

export function manilaDayRange(date = new Date()) {
  const parts = manilaDateParts(date);
  const fromInput = `${parts.year}-${parts.month}-${parts.day}`;

  return {
    fromInput,
    toInput: fromInput,
    dateRange: {
      gte: manilaDate(fromInput),
      lte: manilaDate(fromInput, true)
    }
  };
}

export function manilaWeekRange(date = new Date()) {
  const today = manilaDayRange(date).dateRange.gte!;
  const day = manilaWeekday(date);
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const fromInput = inputValue(start);
  const toInput = inputValue(end);

  return {
    fromInput,
    toInput,
    dateRange: {
      gte: manilaDate(fromInput),
      lte: manilaDate(toInput, true)
    }
  };
}

export function manilaMonthRange(date = new Date()) {
  const parts = manilaDateParts(date);
  const year = Number(parts.year);
  const month = Number(parts.month);
  const fromInput = `${parts.year}-${parts.month}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const toInput = `${parts.year}-${parts.month}-${String(lastDay).padStart(2, "0")}`;

  return {
    fromInput,
    toInput,
    dateRange: {
      gte: manilaDate(fromInput),
      lte: manilaDate(toInput, true)
    }
  };
}

export function getReportDateRange(params: {
  range?: string;
  from?: string;
  to?: string;
  fallback?: ReportRangePreset;
}): ReportDateRange {
  const requestedRange = parseRangePreset(params.range ?? params.fallback);
  let range = params.range ? requestedRange : params.fallback ?? requestedRange;
  const today = manilaDayRange();
  let resolved = today;
  let label = "today";

  if (range === "week") {
    resolved = manilaWeekRange();
    label = "this week";
  } else if (range === "month") {
    resolved = manilaMonthRange();
    label = "this month";
  } else if (range === "custom") {
    const from = parseDateInput(params.from);
    const to = parseDateInput(params.to, true);

    if (from && to && from <= to) {
      resolved = {
        fromInput: params.from!,
        toInput: params.to!,
        dateRange: {
          gte: from,
          lte: to
        }
      };
      label = `${labelDate(resolved.fromInput)} - ${labelDate(resolved.toInput)}`;
    } else {
      range = params.fallback ?? "today";
      if (range === "week") {
        resolved = manilaWeekRange();
        label = "this week";
      } else if (range === "month") {
        resolved = manilaMonthRange();
        label = "this month";
      } else {
        resolved = today;
        label = "today";
      }
    }
  }

  return {
    range,
    fromInput: resolved.fromInput,
    toInput: resolved.toInput,
    dateRange: resolved.dateRange,
    label
  };
}
