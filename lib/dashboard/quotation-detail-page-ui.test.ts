import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync("app/(dashboard)/quotations/[id]/page.tsx", "utf8");

test("quotation detail page includes item snapshot images in quoted items", () => {
  assert.match(source, /images:\s*\{\s*orderBy:/);
  assert.match(source, /function quotationItemImage/);
  assert.match(source, /<span>Image<\/span>/);
  assert.match(source, /bg-contain bg-center bg-no-repeat/);
  assert.match(source, /<ImagePlus className="h-4 w-4" \/>/);
});

test("quotation detail page contains table scroll and narrower side panel", () => {
  assert.match(source, /xl:grid-cols-\[minmax\(0,1fr\)_minmax\(240px,300px\)\]/);
  assert.match(source, /quotationDetailItemGridClass/);
  assert.doesNotMatch(source, /table-fixed/);
  assert.doesNotMatch(source, /min-w-\[720px\]/);
  assert.match(source, /whitespace-pre-wrap break-words/);
});
