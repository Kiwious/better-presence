import * as assert from "assert";
import { statsLines } from "../pet";
import { applyEntry, currentStep, emptyStats, modelName, type SessionStats } from "../session-stats";

const tool = (name: string, input = {}) => ({
  type: "assistant",
  message: { content: [{ type: "tool_use", name, input }] },
});
const plan = (statuses: string[]) => ({
  items: statuses.map((status, i) => ({ content: `step ${i + 1}`, status })),
});

function run(...entries: object[]) {
  const stats = emptyStats();
  entries.forEach((entry) => applyEntry(stats, entry));
  return stats;
}

suite("session stats", () => {
  test("counts tools and prompts, not subagents or tool results", () => {
    const stats = run(
      { type: "user", message: { content: "hi" } },
      { type: "user", isMeta: true, message: { content: "hidden" } },
      { type: "user", message: { content: [{ type: "tool_result" }] } },
      tool("Edit"), tool("Write"), tool("Read"), tool("Bash"), tool("PowerShell"), tool("Grep"),
      { ...tool("Edit"), isSidechain: true },
    );
    assert.deepStrictEqual(
      [stats.prompts, stats.edits, stats.reads, stats.commands, stats.searches],
      [1, 2, 1, 2, 1],
    );
  });

  test("keeps the latest model, branch, version and context", () => {
    const stats = run({
      type: "assistant",
      version: "2.1.309",
      gitBranch: "main",
      message: {
        model: "claude-opus-5-5",
        content: [],
        usage: { input_tokens: 1, cache_read_input_tokens: 2000, cache_creation_input_tokens: 3 },
      },
    });
    assert.strictEqual(modelName(stats.model), "Opus 5.5");
    assert.strictEqual(stats.branch, "main");
    assert.strictEqual(stats.version, "2.1.309");
    assert.strictEqual(stats.contextTokens, 2004);
  });

  test("follows the task list and clears it on wrap up", () => {
    const update = "mcp__ccd_turn__update_plan";
    const started = tool(update, plan(["in_progress", "pending", "pending"]));
    assert.strictEqual(currentStep(run(started))?.number, 1);
    assert.strictEqual(currentStep(run(started, tool(update, { advance: true })))?.number, 2);
    assert.strictEqual(currentStep(run(started, tool(update, { done: [1, 2], start: 3 })))?.number, 3);
    assert.strictEqual(currentStep(run(started, tool("mcp__ccd_turn__wrap_up"))), undefined);
  });

  test("notices failures, interruptions, streaks, commits and compaction", () => {
    const result = (is_error: boolean) => ({ type: "user", message: { content: [{ type: "tool_result", is_error }] } });
    const stop = { type: "user", message: { content: [{ type: "text", text: "[Request interrupted by user]" }] } };
    const stats = run(tool("Bash", { command: "git commit -m x" }), result(true), result(true));
    assert.strictEqual(stats.failures, 2);
    assert.strictEqual(stats.commits, 1);
    assert.strictEqual(run(result(true), result(false)).failures, 0);
    const stopped = run(result(true), stop);
    assert.deepStrictEqual([stopped.interrupted, stopped.prompts, stopped.failures], [true, 0, 0]);
    assert.strictEqual(run(stop, { type: "user", message: { content: "go on" } }).interrupted, false);
    assert.strictEqual(run(tool("Read"), tool("Read"), tool("Edit"), tool("Read")).streak, 1);
    assert.strictEqual(run(tool("Read"), tool("Read"), tool("mcp__ccd_turn__update_plan"), tool("Read")).streak, 3);
    const usage = (tokens: number) => ({ type: "assistant", message: { content: [], usage: { input_tokens: tokens } } });
    assert.strictEqual(run(usage(100_000), usage(20_000)).compactions, 1);
    assert.strictEqual(run(usage(100_000), usage(120_000)).compactions, 0);
  });

  test("keeps no message text", () => {
    const stats = run(
      { type: "user", message: { content: "my secret prompt" } },
      tool("Bash", { command: "secret command" }),
    );
    assert.ok(!JSON.stringify(stats).includes("secret"));
  });

  test("lines react to the numbers and fit Discord", () => {
    const base: SessionStats = {
      ...emptyStats(),
      edits: 120, commands: 150, reads: 300, searches: 9, prompts: 60, contextTokens: 450_000,
      model: "claude-opus-5-5", version: "2.1.309", branch: "main",
      steps: plan(["completed", "in_progress"]).items,
    };
    const lines = statsLines(base, 4);
    for (const expected of [
      "Clawd counted 120 edits so far",
      "Clawd runs on Opus 5.5 today",
      "I'm nervous, you're on main!",
      "My tiny claws hurt from all the typing",
      "I live in the terminal now",
      "I can't remember anything anymore. Who are you?",
      "I can see the finish line!",
      "I have to share you with 4 other sessions",
    ]) {
      assert.ok(lines.includes(expected), expected);
    }
    assert.ok(statsLines(emptyStats(), 0).includes("I have you all to myself"));
    assert.ok(statsLines({ ...base, branch: "fix/login" }, 1).includes("I smell a bug on this branch. Yum."));
    for (const line of lines) {
      assert.ok(line.length >= 2 && line.length <= 128);
    }
  });
});
