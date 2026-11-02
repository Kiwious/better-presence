import * as assert from "assert";
import { petLine, petMood, type Mood } from "../pet";

suite("Pet", () => {
  test("mood follows work and idle time", () => {
    const minute = 60_000;
    assert.strictEqual(petMood(true, 999 * minute), "busy");
    assert.strictEqual(petMood(false, 9 * minute), "content");
    assert.strictEqual(petMood(false, 10 * minute), "hungry");
    assert.strictEqual(petMood(false, 60 * minute), "asleep");
  });

  test("lines fit Discord's 2-128 characters", () => {
    for (const mood of ["busy", "content", "hungry", "asleep"] as Mood[]) {
      for (let i = 0; i < 200; i++) {
        const { length } = petLine(mood);
        assert.ok(length >= 2 && length <= 128);
      }
    }
  });
});
