import type { EventData, EventType, PresenceEvent } from "./events.ts";

const FILE_TOOLS = new Set(["Edit", "MultiEdit", "Write", "Read", "NotebookEdit"]);
const ATTENTION = new Set(["permission_prompt", "elicitation_dialog", "agent_needs_input"]);

/** Last segment of a POSIX or Windows path. */
export const basename = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? "";

const str = (value: unknown) => (typeof value === "string" && value !== "" ? value : undefined);

/**
 * Turns the raw JSON a Claude Code hook receives into a PresenceEvent.
 * Returns null for input that is not a hook payload or an event we do not show.
 * Prompt text, tool input and assistant messages are never copied.
 */
export function normalizeClaudeCode(raw: unknown, ts = Date.now()): PresenceEvent | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const hook = raw as Record<string, unknown>;
  const sessionId = str(hook.session_id);
  const name = str(hook.hook_event_name);
  if (!sessionId || !name) {
    return null;
  }

  const tool = str(hook.tool_name);
  const cwd = str(hook.cwd);
  const data: EventData = {};
  let type: EventType;

  switch (name) {
    case "SessionStart":
      type = "session.start";
      data.model = str(hook.model);
      break;
    case "UserPromptSubmit":
      type = "prompt.submit";
      break;
    case "PreToolUse": {
      type = "tool.start";
      data.tool = tool;
      const input = hook.tool_input as Record<string, unknown> | undefined;
      const path = tool && FILE_TOOLS.has(tool) ? str(input?.file_path ?? input?.notebook_path) : undefined;
      data.file = path && basename(path);
      break;
    }
    case "PostToolUse":
    case "PostToolUseFailure":
      type = "tool.end";
      data.tool = tool;
      data.error = name === "PostToolUseFailure" || undefined;
      break;
    case "SubagentStart":
      type = "subagent.start";
      break;
    case "SubagentStop":
      type = "subagent.end";
      break;
    case "Notification": {
      const kind = str(hook.notification_type);
      if (kind && ATTENTION.has(kind)) {
        type = "attention.needed";
        data.reason = kind;
      } else if (kind === "idle_prompt") {
        type = "turn.stop";
      } else {
        return null;
      }
      break;
    }
    case "Stop":
      type = "turn.stop";
      break;
    case "StopFailure":
      type = "turn.stop";
      data.error = true;
      break;
    case "SessionEnd":
      type = "session.end";
      data.reason = str(hook.reason);
      break;
    default:
      return null;
  }

  data.project = cwd && basename(cwd);
  data.title = str(hook.session_title);

  // Drop unset keys so the event stays small and easy to compare in tests.
  const clean = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
  return { v: 1, source: "claude-code", sessionId, ts, type, data: clean };
}
