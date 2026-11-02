import assert from "node:assert/strict";
import test from "node:test";
import { normalizeClaudeCode } from "../src/index.ts";

const base = { session_id: "s1", cwd: "/home/kevin/my-app", transcript_path: "/tmp/t.jsonl" };

test("UserPromptSubmit never keeps the prompt text", () => {
  const event = normalizeClaudeCode(
    { ...base, hook_event_name: "UserPromptSubmit", prompt: "my secret plan", session_title: "Refactor" },
    1,
  );
  assert.deepEqual(event, {
    v: 1,
    source: "claude-code",
    sessionId: "s1",
    ts: 1,
    type: "prompt.submit",
    data: { project: "my-app", title: "Refactor" },
  });
  assert.ok(!JSON.stringify(event).includes("secret"));
});

test("PreToolUse keeps only the file basename, also for Windows paths", () => {
  const event = normalizeClaudeCode({
    ...base,
    cwd: "C:\\Repos\\claude-presence",
    hook_event_name: "PreToolUse",
    tool_name: "Edit",
    tool_input: { file_path: "C:\\Repos\\claude-presence\\src\\main.ts", old_string: "a", new_string: "b" },
  });
  assert.deepEqual(event?.data, { tool: "Edit", file: "main.ts", project: "claude-presence" });
});

test("PreToolUse of a non-file tool has no file", () => {
  const event = normalizeClaudeCode({ ...base, hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "rm -rf x" } });
  assert.deepEqual(event?.data, { tool: "Bash", project: "my-app" });
});

test("maps tool end, failures, stop and session end", () => {
  const type = (raw: object) => normalizeClaudeCode({ ...base, ...raw })?.type;
  assert.equal(type({ hook_event_name: "SessionStart", source: "startup" }), "session.start");
  assert.equal(type({ hook_event_name: "PostToolUse", tool_name: "Read" }), "tool.end");
  assert.equal(normalizeClaudeCode({ ...base, hook_event_name: "PostToolUseFailure", tool_name: "Bash" })?.data?.error, true);
  assert.equal(type({ hook_event_name: "SubagentStart" }), "subagent.start");
  assert.equal(type({ hook_event_name: "SubagentStop" }), "subagent.end");
  assert.equal(type({ hook_event_name: "Stop" }), "turn.stop");
  assert.equal(type({ hook_event_name: "StopFailure" }), "turn.stop");
  assert.equal(type({ hook_event_name: "SessionEnd", reason: "prompt_input_exit" }), "session.end");
});

test("Notification: permission prompt needs attention, idle prompt stops the turn, others are ignored", () => {
  const type = (kind: string) => normalizeClaudeCode({ ...base, hook_event_name: "Notification", notification_type: kind, message: "x" })?.type;
  assert.equal(type("permission_prompt"), "attention.needed");
  assert.equal(type("idle_prompt"), "turn.stop");
  assert.equal(type("auth_success"), undefined);
});

test("rejects input that is not a hook payload and ignores unknown events", () => {
  for (const raw of [null, "x", 42, [], {}, { session_id: "s1" }, { hook_event_name: "Stop" }, { session_id: 5, hook_event_name: "Stop" }]) {
    assert.equal(normalizeClaudeCode(raw), null);
  }
  assert.equal(normalizeClaudeCode({ ...base, hook_event_name: "PreCompact" }), null);
});
