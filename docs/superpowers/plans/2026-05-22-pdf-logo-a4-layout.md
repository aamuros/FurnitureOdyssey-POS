# PDF Logo A4 Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Furniture Odyssey logo to every generated operational PDF and keep all outputs on A4 with tighter single-page-friendly spacing.

**Architecture:** The app has one React-PDF template, `OperationalPdfDocument`, fed by `OperationalPdfData` from `lib/pdf/data.ts`; all document routes use `renderOperationalPdf()`. The implementation will move the local logo into a tracked PDF asset path, expose a server-side asset helper, default PDF company data to that logo, and tighten the shared template styles without changing business fields.

**Tech Stack:** Next.js, TypeScript, React-PDF, Node test runner with `tsx`.

---

### Task 1: Add PDF Branding Regression Tests

**Files:**
- Create: `lib/pdf/operational-document.test.ts`
- Create: `lib/pdf/assets.ts`
- Modify: `lib/pdf/data.ts`

- [ ] **Step 1: Write the failing tests**

Create tests that import `defaultPdfLogoSource` and `companyForPdf`, assert that the default logo resolves to an existing local image under `assets/pdf/logo.png`, that `companyForPdf()` falls back to it, and that the shared React-PDF template keeps `Page size="A4"` and uses the company logo image.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm.cmd test -- lib/pdf/operational-document.test.ts`

Expected: FAIL because `lib/pdf/assets.ts` and `companyForPdf` export do not exist yet.

### Task 2: Move Logo and Add Asset Helper

**Files:**
- Move: `public/logo.png` to `assets/pdf/logo.png`
- Create: `lib/pdf/assets.ts`

- [ ] **Step 1: Move the logo**

Move the approved existing logo file from `public/logo.png` into `assets/pdf/logo.png`.

- [ ] **Step 2: Add helper**

Add `defaultPdfLogoSource()` that returns the absolute filesystem path for `assets/pdf/logo.png` when present, otherwise `null`.

### Task 3: Apply Logo Fallback and Tighten A4 Template

**Files:**
- Modify: `lib/pdf/data.ts`
- Modify: `lib/pdf/operational-document.tsx`

- [ ] **Step 1: Use the helper in PDF data**

Export `companyForPdf()` and set `logoUrl` to `settings.companyProfile.logoUrl || defaultPdfLogoSource()`.

- [ ] **Step 2: Adjust shared PDF spacing**

Keep `Page size="A4"`. Reduce page padding and section/table spacing, use a compact logo size in the header, and keep all fields in the same order.

- [ ] **Step 3: Run tests**

Run: `npm.cmd test -- lib/pdf/operational-document.test.ts`

Expected: PASS.

### Task 4: Validate End-to-End

**Files:**
- No code changes expected.

- [ ] **Step 1: Run required checks**

Run:
- `npm.cmd run lint`
- `npm.cmd run typecheck`
- `npm.cmd test`
- `npm.cmd run build`

- [ ] **Step 2: Generate or inspect PDFs locally**

Use the document API/dev server where available, or render representative PDF buffers through the React-PDF renderer, and capture notes confirming logo placement and A4 template usage.
