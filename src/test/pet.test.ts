import * as assert from "assert";
import { petChatter, petLine, petMood, type Mood } from "../pet";

suite("Pet", () => {
  test("mood follows work and idle time", () => {
    const minute = 60_000;
    assert.strictEqual(petMood(true, 999 * minute), "busy");
    assert.strictEqual(petMood(false, 9 * minute), "content");
    assert.strictEqual(petMood(false, 10 * minute), "hungry");
    assert.strictEqual(petMood(false, 60 * minute), "asleep");
  });

  test("chatter mixes lines and facts", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      seen.add(petChatter("asleep", 75 * 60_000, "siris", "Fix login"));
    }
    assert.ok(seen.has("Clawd is dreaming of siris"));
    assert.ok(seen.has("Clawd is rooting for: Fix login"));
    assert.ok(seen.has("Mood: 💤 asleep"));
    assert.ok(seen.has("Clawd has been around for 1 h 15 min"));
    assert.ok(seen.has("Clawd lives in siris"));
    assert.ok(seen.has("Clawd is asleep. Zzz…"));
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
