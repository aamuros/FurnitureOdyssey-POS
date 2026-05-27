import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync("components/dashboard/quotation-workspace.tsx", "utf8");

test("quotation product picker gives cards enough room and shows full product images", () => {
  assert.match(
    source,
    /<article className="[^"]*min-h-\[380px\][^"]*"/,
    "product picker cards should be tall enough for product details and actions"
  );
  assert.match(
    source,
    /className="[^"]*bg-contain[^"]*bg-no-repeat[^"]*"/,
    "product picker images should use contain sizing instead of cropping"
  );
  assert.doesNotMatch(
    source,
    /className="[^"]*bg-cover[^"]*sm:h-40[^"]*lg:h-44[^"]*"/,
    "product picker images should not use the old cropped compact image well"
  );
});

test("quotation product picker keeps variants under one base product card", () => {
  assert.match(source, /colorVariants: ProductColorVariantOption\[\]/);
  assert.match(source, /selectedVariantId/);
  assert.match(source, /createCatalogItem\(product, current\.length, needsAssembly, selectedVariant\)/);
  assert.match(source, /selectedVariantByProductId/);
  assert.doesNotMatch(
    source,
    /function ProductCard\(\{ product \}: \{ product: ProductOption \}\) \{\s*const \[selectedVariantId/,
    "variant selection must be owned by ProductPicker so adding one product does not remount cards and reset variants"
  );
  assert.doesNotMatch(
    source,
    /flatMap\([^)]*colorVariants/,
    "color variants should not be flattened into separate product cards"
  );
});

test("quotation workspace applies horizontal overflow guards", () => {
  assert.match(source, /className="mt-6 grid min-w-0 max-w-full gap-6 overflow-x-hidden/);
  assert.match(source, /className="min-w-0 max-w-full overflow-x-auto p-5"/);
  assert.match(source, /className="hidden min-w-\[920px\]/);
  assert.match(source, /break-words/);
});

test("quotation items serialize selected variant snapshot fields", () => {
  assert.match(source, /snapshotVariantId: item\.selectedVariantId \|\| undefined/);
  assert.match(source, /snapshotVariantName: item\.selectedVariantName \|\| undefined/);
  assert.match(source, /snapshotVariantHex: item\.selectedVariantHex \|\| undefined/);
});
