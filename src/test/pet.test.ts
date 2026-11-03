import * as assert from "assert";
import { momentLines, petChatter, petLine, petMood, petWish, situationLines, statsLines, type Mood } from "../pet";
import { petToken } from "../pet-state";
import { emptyStats } from "../session-stats";

const scenarioLines = (mood: Mood, minutes: number, now: Date, folder?: string, action?: string) => [
  ...momentLines(mood, action),
  ...situationLines(mood, minutes, now, folder),
];

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

  test("at least 200 scenarios, each fitting Discord and the moment", () => {
    const actions = [
      "Editing a.md", "Editing b.json", "Editing c.test.ts", "Editing D.java", "Reading e.py", "Reading f.cpp", "Reading g.css",
      "Editing h.rs", "Reading i.go", "Editing j.sh", "Reading k.yml", "Editing l.sql", "Reading yarn.lock", "Reading m.png", "Reading n.html", "Reading o.js",
      "Running a command", "Searching the code", "Browsing the web", "Running a subagent", "Thinking", "Working",
      "Running the tests", "Building", "Linting", "Installing packages", "Committing", "Pushing", "Syncing with git", "Checking git",
      "Talking to GitHub", "Deleting files", "Running containers", "Asking you something", "Planning", "Using a skill",
      "Working on a page", "Looking for a tool", "Using a connector", "Setting a timer", "Managing sessions",
    ];
    for (const action of actions) {
      assert.ok(momentLines("busy", action).length >= 3, action);
    }
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
    assert.ok(seen.size >= 200, `only ${seen.size}`);
    for (const line of seen) {
      assert.ok(line.length >= 2 && line.length <= 128);
    }
    const sunday3am = new Date(2026, 10, 1, 3);
    assert.ok(scenarioLines("busy", 1, sunday3am).includes("Clawd says it's past bedtime"));
    assert.ok(scenarioLines("busy", 1, sunday3am).includes("Clawd works weekends too"));
    assert.ok(!scenarioLines("asleep", 300, sunday3am).includes("Clawd works weekends too"));
    assert.ok(scenarioLines("busy", 30, sunday3am, undefined, "Editing x.java").includes("Clawd ordered more coffee"));
  });

  test("every reaction gets its turn before any repeats, and only on its occasion", () => {
    const moment = momentLines("busy", "Running the tests");
    const others = momentLines("busy", "Pushing");
    const seen: string[] = [];
    for (let i = 0; i < 400; i++) {
      seen.push(petChatter("busy", 30 * 60_000, undefined, undefined, "Running the tests").replace(/ \p{Extended_Pictographic}$/u, ""));
    }
    for (const line of moment) {
      assert.ok(seen.includes(line), line);
    }
    assert.ok(!seen.some((line) => others.includes(line)));
    const reactions = seen.filter((line) => moment.includes(line));
    assert.strictEqual(new Set(reactions.slice(0, moment.length)).size, moment.length);
    const share = reactions.length / seen.length;
    assert.ok(share > 0.4 && share < 0.6, `share ${share}`);
  });

  test("changing numbers don't crowd out the other lines", () => {
    const seen = new Set<string>();
    for (let minutes = 0; minutes < 300; minutes++) {
      seen.add(petChatter("content", minutes * 60_000).replace(/ \p{Extended_Pictographic}$/u, ""));
    }
    assert.ok(seen.has("I'm wagging my claws *snip snip*"));
    assert.ok(seen.has("A new prompt, pretty please?"));
  });

  test("failures, interruptions and streaks take over the moment", () => {
    const failed = { ...emptyStats(), failures: 1, failedAction: "Running the tests" };
    assert.ok(momentLines("busy", "Thinking", failed).includes("Red! I said green!"));
    assert.ok(!momentLines("busy", "Thinking", { ...failed, failedAction: "Pushing" }).includes("Red! I said green!"));
    assert.ok(momentLines("hungry", undefined, failed).includes("That didn't work. I saw nothing."));
    assert.ok(momentLines("content", undefined, { ...emptyStats(), interrupted: true }).includes("I stopped. Mid-snip."));
    const streak = { ...emptyStats(), streak: 6, streakTool: "read" };
    assert.ok(momentLines("busy", "Reading a.ts", streak).includes("I've read 6 files in a row. No spoilers."));
    assert.ok(momentLines("content", undefined, { ...emptyStats(), action: "Asking you something" }).includes("I can't decide, you pick"));
    assert.ok(!momentLines("asleep", undefined, failed).includes("That didn't work. I saw nothing."));
  });

  test("Clawd doesn't brag about nothing", () => {
    assert.ok(!statsLines(emptyStats(), 0).some((line) => /\b0 (edits|commands|prompts|files|times)\b/.test(line)));
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
    const terminal = ["I'm watching the terminal go brrr 🍿", "I'm playing whack-a-command 🔨"];
    const lines = Array.from({ length: 1000 }, () => petWish("busy", "Running a command").line);
    const share = lines.filter((line) => terminal.includes(line)).length / lines.length;
    assert.ok(share > 0.4 && share < 0.6, `share ${share}`);
    for (const line of terminal) {
      assert.ok(lines.includes(line), line);
    }
    for (let i = 0; i < 200; i++) {
      assert.ok(!terminal.includes(petWish("content", "Running a command").line));
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
    assert.strictEqual(petToken("Running the tests"), "bash");
    assert.strictEqual(petToken("Committing"), "bash");
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
