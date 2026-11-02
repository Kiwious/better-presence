import assert from "node:assert/strict";
import test from "node:test";
import { applyEvent, expireSessions, pickSession, type EventType, type PresenceEvent, type Sessions, type Source } from "../src/index.ts";

const ev = (type: EventType, ts: number, data?: PresenceEvent["data"], sessionId = "s1", source: Source = "claude-code"): PresenceEvent =>
  ({ v: 1, source, sessionId, ts, type, data });

test("a Claude turn moves idle → thinking → tool → thinking → idle", () => {
  const sessions: Sessions = new Map();
  const states: string[] = [];
  for (const event of [
    ev("session.start", 1, { project: "app" }),
    ev("prompt.submit", 2),
    ev("tool.start", 3, { tool: "Edit", file: "a.ts" }),
    ev("tool.end", 4, { tool: "Edit" }),
    ev("turn.stop", 5),
  ]) {
    applyEvent(sessions, event);
    states.push(sessions.get("claude-code:s1")!.state);
  }
  assert.deepEqual(states, ["idle", "thinking", "tool", "thinking", "idle"]);
  const session = sessions.get("claude-code:s1")!;
  assert.equal(session.project, "app");
  assert.equal(session.file, undefined);
  assert.equal(session.startedAt, 1);
  assert.equal(session.lastEventAt, 5);
});

test("an event for an unknown session creates it", () => {
  const sessions: Sessions = new Map();
  applyEvent(sessions, ev("tool.start", 7, { tool: "Bash" }));
  assert.equal(sessions.get("claude-code:s1")?.state, "tool");
  assert.equal(sessions.get("claude-code:s1")?.startedAt, 7);
});

test("subagent counter never goes negative and resets when the turn stops", () => {
  const sessions: Sessions = new Map();
  applyEvent(sessions, ev("subagent.end", 1));
  assert.equal(sessions.get("claude-code:s1")!.subagents, 0);
  applyEvent(sessions, ev("subagent.start", 2));
  applyEvent(sessions, ev("subagent.start", 3));
  assert.equal(sessions.get("claude-code:s1")!.subagents, 2);
  applyEvent(sessions, ev("turn.stop", 4));
  assert.equal(sessions.get("claude-code:s1")!.subagents, 0);
});

test("session.end removes the session, expireSessions removes stale ones", () => {
  const sessions: Sessions = new Map();
  applyEvent(sessions, ev("session.start", 1, undefined, "a"));
  applyEvent(sessions, ev("session.start", 100, undefined, "b"));
  applyEvent(sessions, ev("session.end", 101, undefined, "b"));
  assert.deepEqual([...sessions.keys()], ["claude-code:a"]);
  expireSessions(sessions, 1 + 30, 30);
  assert.equal(sessions.size, 1);
  expireSessions(sessions, 1 + 31, 30);
  assert.equal(sessions.size, 0);
});

test("pickSession: waiting > working > editing > Claude idle > VS Code idle, ties go to the newest", () => {
  const sessions: Sessions = new Map();
  const pick = () => { const s = pickSession(sessions)!; return `${s.source}:${s.id}`; };

  applyEvent(sessions, ev("editor.idle", 1, undefined, "w", "vscode"));
  assert.equal(pick(), "vscode:w");
  applyEvent(sessions, ev("session.start", 2, undefined, "idle"));
  assert.equal(pick(), "claude-code:idle");
  applyEvent(sessions, ev("editor.focus", 3, { file: "a.ts" }, "w", "vscode"));
  assert.equal(pick(), "vscode:w");
  applyEvent(sessions, ev("prompt.submit", 4, undefined, "busy1"));
  applyEvent(sessions, ev("prompt.submit", 5, undefined, "busy2"));
  assert.equal(pick(), "claude-code:busy2");
  applyEvent(sessions, ev("attention.needed", 6, undefined, "busy1"));
  assert.equal(pick(), "claude-code:busy1");
  assert.equal(pickSession(new Map()), undefined);
});
