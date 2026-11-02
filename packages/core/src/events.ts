export type Source = "claude-code" | "vscode" | "claude-desktop";

export type EventType =
  | "session.start"
  | "session.end"
  | "prompt.submit"
  | "tool.start"
  | "tool.end"
  | "subagent.start"
  | "subagent.end"
  | "attention.needed"
  | "turn.stop"
  | "editor.focus"
  | "editor.idle"
  | "heartbeat";

export interface EventData {
  /** Basename of the working directory or the workspace name. */
  project?: string;
  /** Custom session title, only set when the user named the session. */
  title?: string;
  model?: string;
  tool?: string;
  /** Basename only, never a full path. */
  file?: string;
  language?: string;
  reason?: string;
  error?: boolean;
}

export interface PresenceEvent {
  v: 1;
  source: Source;
  sessionId: string;
  /** Milliseconds since epoch. */
  ts: number;
  type: EventType;
  data?: EventData;
}
