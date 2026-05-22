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
