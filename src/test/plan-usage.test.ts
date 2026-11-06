import * as assert from "assert";
import { resetFromHeaders, shouldAsk } from "../plan-usage";

const MIN = 60 * 1000;

suite("limit reset", () => {
  test("reads the 5h reset from the reply headers", () => {
    const headers = new Headers({ "anthropic-ratelimit-unified-5h-reset": "1794004800" });
    assert.strictEqual(resetFromHeaders(headers), 1794004800000);
    assert.strictEqual(resetFromHeaders(new Headers()), undefined);
  });

  test("asks only while busy, when unknown, and not too often", () => {
    assert.strictEqual(shouldAsk(true, undefined, 0, 20 * MIN), true);
    assert.strictEqual(shouldAsk(false, undefined, 0, 20 * MIN), false);
    assert.strictEqual(shouldAsk(true, 5, 0, 20 * MIN), false);
    assert.strictEqual(shouldAsk(true, undefined, 15 * MIN, 20 * MIN), false);
  });
});
