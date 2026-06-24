export function fallbackText(value: string | null | undefined, fallback = "Not specified") {
  return value?.trim() ? value : fallback;
}

export function titleCaseLabel(value: string | null | undefined, fallback = "Not specified") {
  if (!value) {
    return fallback;
  }

  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatMoney(value: number, currency = "PHP") {
  const amount = new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);

  return `${currency} ${amount}`;
}

export function formatMoneyAmount(value: number) {
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

export function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function hasMoney(value: unknown) {
  const amount = Number(value);

  return Number.isFinite(amount) && Math.abs(amount) > 0;
}

export function hasQuantity(value: unknown) {
  const quantity = Number(value);

  return Number.isFinite(quantity) && quantity > 0;
}

export function isMeaningfulValue(value: unknown): boolean {
  if (value == null) {
    return false;
  }

  if (typeof value === "string") {
    return hasText(value);
  }

  if (typeof value === "number" || typeof value === "bigint") {
    return hasMoney(value);
  }

  if (Array.isArray(value)) {
    return value.some(isMeaningfulValue);
  }

  if (typeof value === "object") {
    return Object.values(value).some(isMeaningfulValue);
  }

  return Boolean(value);
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatQuantity(value: number) {
  const quantity = Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;

  return new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: 0
  }).format(quantity);
}

export function formatDocumentNumber(prefix: string, value: string | null | undefined) {
  const identifier = fallbackText(value, "Pending");

  return `${prefix}-${identifier}`;
}

export function formatPaymentStatus(value: string | null | undefined) {
  return titleCaseLabel(value);
}

export function formatDeliveryStatus(value: string | null | undefined) {
  return titleCaseLabel(value);
}

export function safeFilename(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function isPresentPdfText(value: string | null | undefined): value is string {
  const trimmed = value?.trim();

  if (!trimmed) {
    return false;
  }

  return !/placeholder/i.test(trimmed) && !/^not (specified|set|linked|assigned)$/i.test(trimmed);
}

export function isSalesInvoiceFeeLabel(label: string) {
  return /^sales invoice fee$/i.test(label.trim());
}

export function moneyValueFromText(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const normalized = trimmed
    .replace(/\(([^)]+)\)/g, "-$1")
    .replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

export function shouldDisplayPdfAmountRow(
  row: { label: string; value: string | null | undefined },
  options: { alwaysShowLabels?: RegExp[]; hideZeroMoneyRows?: boolean } = {}
) {
  if (!isPresentPdfText(row.value)) {
    return false;
  }

  if (options.alwaysShowLabels?.some((pattern) => pattern.test(row.label))) {
    return true;
  }

  const moneyValue = moneyValueFromText(row.value);

  if (options.hideZeroMoneyRows && moneyValue !== null) {
    return Math.abs(moneyValue) > 0;
  }

  return true;
}
