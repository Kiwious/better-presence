import type { PresenceEvent, Source } from "./events.ts";

export type SessionState = "idle" | "thinking" | "tool" | "waiting" | "editing";

export interface Session {
  source: Source;
  id: string;
  state: SessionState;
  tool?: string;
  file?: string;
  language?: string;
  project?: string;
  title?: string;
  subagents: number;
  startedAt: number;
  lastEventAt: number;
}

export type Sessions = Map<string, Session>;

/** Applies one event to the session map. Events for unknown sessions create them, so a daemon started mid-session still works. */
export function applyEvent(sessions: Sessions, event: PresenceEvent): void {
  const key = `${event.source}:${event.sessionId}`;
  if (event.type === "session.end") {
    sessions.delete(key);
    return;
  }

  const session = sessions.get(key) ?? {
    source: event.source,
    id: event.sessionId,
    state: "idle",
    subagents: 0,
    startedAt: event.ts,
    lastEventAt: event.ts,
  };
  sessions.set(key, session);
  session.lastEventAt = event.ts;
  const data = event.data ?? {};
  session.project = data.project ?? session.project;
  session.title = data.title ?? session.title;

  const set = (state: SessionState, tool?: string, file?: string) => {
    session.state = state;
    session.tool = tool;
    session.file = file;
  };

  switch (event.type) {
    case "prompt.submit":
    case "tool.end":
      set("thinking");
      break;
    case "tool.start":
      set("tool", data.tool, data.file);
      break;
    case "subagent.start":
      session.subagents++;
      break;
    case "subagent.end":
      session.subagents = Math.max(0, session.subagents - 1);
      break;
    case "attention.needed":
      set("waiting");
      break;
    case "turn.stop":
      set("idle");
      session.subagents = 0;
      break;
    case "editor.focus":
      set("editing", undefined, data.file);
      session.language = data.language;
      break;
    case "editor.idle":
      set("idle");
      break;
    // session.start and heartbeat only refresh lastEventAt and metadata.
  }
}

/** Removes sessions without events for `timeoutMs`. A crashed terminal never sends SessionEnd. */
export function expireSessions(sessions: Sessions, now: number, timeoutMs: number): void {
  for (const [key, session] of sessions) {
    if (now - session.lastEventAt > timeoutMs) {
      sessions.delete(key);
    }
  }
}

/** Lower is more important. */
function rank(session: Session): number {
  const claude = session.source !== "vscode";
  switch (session.state) {
    case "waiting":
      return 1;
    case "thinking":
    case "tool":
      return 2;
    case "editing":
      return 3;
    default:
      return claude ? 4 : 5;
  }
}

/** The session to show: most important state first, then the most recent event. */
export function pickSession(sessions: Sessions): Session | undefined {
  let best: Session | undefined;
  for (const session of sessions.values()) {
    if (!best || rank(session) < rank(best) || (rank(session) === rank(best) && session.lastEventAt > best.lastEventAt)) {
      best = session;
    }
  }
  return best;
}
