import assert from "node:assert/strict";
import test from "node:test";
import { toActivity, type Session } from "../src/index.ts";

const claude = (patch: Partial<Session>): Session => ({
  source: "claude-code", id: "s1", state: "idle", subagents: 0, startedAt: 10, lastEventAt: 20, project: "app", ...patch,
});
const details = (patch: Partial<Session>) => toActivity(claude(patch)).details;

test("Claude states map to readable details", () => {
  assert.equal(details({ state: "idle" }), "Waiting for input");
  assert.equal(details({ state: "waiting" }), "Waiting for approval");
  assert.equal(toActivity(claude({ state: "thinking" }), undefined, "Cogitating…").details, "Cogitating…");
  assert.equal(details({ state: "tool", tool: "Edit", file: "main.ts" }), "Editing main.ts");
  assert.equal(details({ state: "tool", tool: "Grep" }), "Reading the codebase");
  assert.equal(details({ state: "tool", tool: "Bash" }), "Running a command");
  assert.equal(details({ state: "tool", tool: "WebSearch" }), "Researching");
  assert.equal(details({ state: "tool", tool: "mcp__github__create_pull_request" }), "Using github");
  assert.equal(details({ state: "tool", tool: "TodoWrite" }), "Thinking…");
  assert.equal(details({ state: "thinking", subagents: 1 }), "Working with 1 subagent");
  assert.equal(details({ state: "tool", tool: "Bash", subagents: 3 }), "Working with 3 subagents");
});

test("Claude activity carries project, timer and images", () => {
  assert.deepEqual(toActivity(claude({ state: "tool", tool: "Bash" })), {
    name: "Claude Code",
    details: "Running a command",
    state: "Project app",
    timestamps: { start: 10 },
    assets: { large_image: "claude-code", large_text: "Claude Code", small_image: "terminal", small_text: "Running a command" },
  });
});

test("privacy settings hide file, project and title; title is hidden by default", () => {
  const session = claude({ state: "tool", tool: "Write", file: "secret.ts", title: "Salary sheet" });
  assert.equal(toActivity(session).state, "Project app");
  const hidden = toActivity(session, { showFileNames: false, showProjectName: false, showSessionTitle: false });
  assert.equal(hidden.details, "Editing a file");
  assert.equal(hidden.state, undefined);
  assert.equal(toActivity(session, { showFileNames: true, showProjectName: true, showSessionTitle: true }).state, "Salary sheet");
});

test("VS Code sessions show the editor status", () => {
  const vscode: Session = { source: "vscode", id: "w", state: "editing", file: "a.ts", project: "app", subagents: 0, startedAt: 1, lastEventAt: 1 };
  assert.equal(toActivity(vscode).details, "Editing a.ts");
  assert.equal(toActivity(vscode).state, "Workspace app");
  assert.equal(toActivity({ ...vscode, state: "idle" }).details, "Idle");
});
