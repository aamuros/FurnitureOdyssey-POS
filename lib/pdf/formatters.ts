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
