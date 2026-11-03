import * as assert from "assert";
import { petChatter, petLine, petMood, petWish, scenarioLines, type Mood } from "../pet";
import { petToken } from "../pet-state";

suite("Pet", () => {
  test("mood follows work and idle time", () => {
    const minute = 60_000;
    assert.strictEqual(petMood(true, 999 * minute), "busy");
    assert.strictEqual(petMood(false, 9 * minute), "content");
    assert.strictEqual(petMood(false, 10 * minute), "hungry");
    assert.strictEqual(petMood(false, 60 * minute), "asleep");
  });

  test("about a quarter of the lines get an emoji", () => {
    const runs = 4000;
    let withEmoji = 0;
    for (let i = 0; i < runs; i++) {
      const line = petChatter("content", 60_000, "siris");
      if (line !== "😊" && /\p{Extended_Pictographic}$/u.test(line)) {
        withEmoji++;
      }
    }
    const share = withEmoji / runs;
    assert.ok(share > 0.18 && share < 0.3, `share ${share}`);
  });

  test("chatter mixes lines and facts", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      seen.add(petChatter("asleep", 75 * 60_000, "siris", "Fix login"));
    }
    assert.ok(seen.has("Clawd is dreaming of siris"));
    assert.ok(seen.has("Clawd is rooting for: Fix login"));
    assert.ok(seen.has("💤"));
    assert.ok([...seen].every((line) => !line.startsWith("Mood:")));
    assert.ok(seen.has("Clawd has been around for 1 h 15 min"));
    assert.ok(seen.has("Clawd lives in siris"));
    assert.ok(seen.has("Clawd is asleep. Zzz…"));
  });

  test("at least 50 scenarios, each fitting Discord and the moment", () => {
    const actions = [
      "Editing a.md", "Editing b.json", "Editing c.test.ts", "Editing D.java", "Reading e.py", "Reading f.cpp", "Reading g.css",
      "Running a command", "Searching the code", "Browsing the web", "Running a subagent", "Thinking",
    ];
    const seen = new Set<string>();
    for (let hours = 0; hours < 24 * 7; hours++) {
      const now = new Date(2026, 10, 2, hours);
      for (const minutes of [1, 30, 70, 130, 300]) {
        for (const action of actions) {
          scenarioLines("busy", minutes, now, "siris", action).forEach((line) => seen.add(line));
        }
        for (const mood of ["content", "hungry", "asleep"] as Mood[]) {
          scenarioLines(mood, minutes, now, "siris").forEach((line) => seen.add(line));
        }
      }
    }
    assert.ok(seen.size >= 50, `only ${seen.size}`);
    for (const line of seen) {
      assert.ok(line.length >= 2 && line.length <= 128);
    }
    const sunday3am = new Date(2026, 10, 1, 3);
    assert.ok(scenarioLines("busy", 1, sunday3am).includes("Clawd says it's past bedtime"));
    assert.ok(scenarioLines("busy", 1, sunday3am).includes("Clawd works weekends too"));
    assert.ok(!scenarioLines("asleep", 300, sunday3am).includes("Clawd works weekends too"));
    assert.ok(scenarioLines("busy", 30, sunday3am, undefined, "Editing x.java").includes("Clawd ordered more coffee"));
  });

  test("wishes fit Discord, end in an emoji and never ask for Competing", () => {
    for (const mood of ["busy", "content", "hungry", "asleep"] as Mood[]) {
      const seen = new Set<number>();
      for (let i = 0; i < 300; i++) {
        const { type, line } = petWish(mood, "Running a command");
        seen.add(type);
        assert.ok(line.length >= 2 && line.length <= 128);
        assert.ok(/\p{Extended_Pictographic}$/u.test(line), line);
      }
      assert.deepStrictEqual([...seen].sort(), [0, 2, 3]);
    }
  });

  test("the moment decides most busy wishes, only while busy", () => {
    const terminal = "I'm watching the terminal go brrr 🍿";
    const lines = Array.from({ length: 1000 }, () => petWish("busy", "Running a command").line);
    const share = lines.filter((line) => line === terminal).length / lines.length;
    assert.ok(share > 0.4 && share < 0.6, `share ${share}`);
    for (let i = 0; i < 200; i++) {
      assert.notStrictEqual(petWish("content", "Running a command").line, terminal);
    }
  });

  test("Clawd mostly says I, sometimes its name", () => {
    const lines = Array.from({ length: 2000 }, () => petLine("busy"));
    const named = lines.filter((line) => line.startsWith("Clawd is ")).length / lines.length;
    assert.ok(named > 0.15 && named < 0.25, `share ${named}`);
    assert.ok(lines.every((line) => line.startsWith("Clawd is ") || line.startsWith("I'm ")));
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      seen.add(petChatter("content", 30 * 60_000, "siris", undefined, undefined, undefined, 0));
    }
    assert.ok([...seen].some((line) => line.startsWith("I")));
    assert.ok([...seen].some((line) => line.startsWith("Clawd")));
  });

  test("the desktop pet's token follows the action", () => {
    assert.strictEqual(petToken("Editing a.ts"), "edit");
    assert.strictEqual(petToken("Reading a.ts"), "read");
    assert.strictEqual(petToken("Searching the code"), "read");
    assert.strictEqual(petToken("Running a command"), "bash");
    assert.strictEqual(petToken("Browsing the web"), "web");
    assert.strictEqual(petToken("Running a subagent"), "task");
    assert.strictEqual(petToken("Thinking"), "think");
    assert.strictEqual(petToken("Working"), "think");
    assert.strictEqual(petToken(undefined), "think");
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
