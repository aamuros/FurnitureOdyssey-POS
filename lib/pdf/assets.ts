import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

let cachedDefaultLogoSource: string | null | undefined;

export function defaultPdfLogoPath() {
  const publicLogoPath = path.join(process.cwd(), "public", "logo", "logo.png");

  if (existsSync(publicLogoPath)) {
    return publicLogoPath;
  }

  return path.join(process.cwd(), "assets", "pdf", "logo.png");
}

export function defaultPdfLogoSource() {
  if (cachedDefaultLogoSource !== undefined) {
    return cachedDefaultLogoSource;
  }

  const logoPath = defaultPdfLogoPath();

  cachedDefaultLogoSource = existsSync(logoPath)
    ? `data:image/png;base64,${readFileSync(logoPath).toString("base64")}`
    : null;

  return cachedDefaultLogoSource;
}
