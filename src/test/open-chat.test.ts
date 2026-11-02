import * as assert from "assert";
import type { AppSession } from "../app-session";
import { chooseSession } from "../open-chat";

const live = (sessionId: string, status = "idle"): AppSession => ({
  pid: 1,
  sessionId,
  cwd: "C:\\repo",
  status,
  startedAt: 1,
});

suite("chooseSession", () => {
  test("prefers the last focused chat over a busy one", () => {
    const sessions = [live("busy", "busy"), live("open")];
    const metas = [
      { cliSessionId: "busy", cwd: "C:\\repo", lastFocusedAt: 10 },
      { cliSessionId: "open", cwd: "C:\\repo", lastFocusedAt: 20 },
    ];
    assert.strictEqual(chooseSession(sessions, metas)?.sessionId, "open");
  });

  test("keeps today's order without a usable focus", () => {
    const sessions = [live("first", "busy"), live("second")];
    assert.strictEqual(chooseSession(sessions, [])?.sessionId, "first");
    assert.strictEqual(chooseSession(sessions, [{ cliSessionId: "second", cwd: "C:\\repo" }])?.sessionId, "first");
    assert.strictEqual(chooseSession([], []), undefined);
  });

  test("skips archived chats", () => {
    const metas = [
      { cliSessionId: "old", cwd: "C:\\repo", lastFocusedAt: 30, isArchived: true },
      { cliSessionId: "first", cwd: "C:\\repo", lastFocusedAt: 20 },
    ];
    assert.strictEqual(chooseSession([live("first")], metas)?.sessionId, "first");
  });

  test("shows a chat without a process as waiting", () => {
    const session = chooseSession([live("other")], [
      { cliSessionId: "asleep", cwd: "C:\\repo", title: "My chat", lastFocusedAt: 20, createdAt: 5, lastActivityAt: 15 },
    ]);
    assert.deepStrictEqual(session, {
      pid: 0,
      sessionId: "asleep",
      cwd: "C:\\repo",
      name: "My chat",
      status: "idle",
      startedAt: 5,
      updatedAt: 15,
    });
  });
});
