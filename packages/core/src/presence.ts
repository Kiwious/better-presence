import type { Session } from "./sessions.ts";

/** The subset of a Discord activity we set. Field names match the Discord RPC payload. */
export interface Activity {
  name: string;
  details: string;
  state?: string;
  timestamps: { start: number };
  assets: { large_image: string; large_text: string; small_image?: string; small_text?: string };
}

export interface PrivacySettings {
  showFileNames: boolean;
  showProjectName: boolean;
  showSessionTitle: boolean;
}

export const defaultPrivacy: PrivacySettings = {
  showFileNames: true,
  showProjectName: true,
  showSessionTitle: false,
};

function describeTool(tool: string | undefined, file: string | undefined): [details: string, icon: string] | undefined {
  switch (tool) {
    case "Edit":
    case "MultiEdit":
    case "Write":
    case "NotebookEdit":
      return [file ? `Editing ${file}` : "Editing a file", "edit"];
    case "Read":
    case "Grep":
    case "Glob":
      return ["Reading the codebase", "read"];
    case "Bash":
    case "PowerShell":
      return ["Running a command", "terminal"];
    case "WebFetch":
    case "WebSearch":
      return ["Researching", "web"];
    case "Agent":
    case "Task":
      return ["Delegating to a subagent", "agents"];
  }
  const server = tool?.match(/^mcp__(.+?)__/)?.[1];
  return server ? [`Using ${server}`, "plug"] : undefined;
}

/**
 * Maps the chosen session to a Discord activity.
 * `thinkingMessage` is the rotating text shown while Claude thinks; the caller picks and rotates it.
 */
export function toActivity(session: Session, privacy = defaultPrivacy, thinkingMessage = "Thinking…"): Activity {
  const file = privacy.showFileNames ? session.file : undefined;
  const project = privacy.showProjectName ? session.project : undefined;

  if (session.source === "vscode") {
    return {
      name: "Visual Studio Code",
      details: session.state === "editing" ? (file ? `Editing ${file}` : "Editing a file") : "Idle",
      state: project && `Workspace ${project}`,
      timestamps: { start: session.startedAt },
      assets: { large_image: "vscode", large_text: "Visual Studio Code" },
    };
  }

  let details: string;
  let icon: string;
  if (session.state === "waiting") {
    [details, icon] = ["Waiting for approval", "attention"];
  } else if (session.state === "idle") {
    [details, icon] = ["Waiting for input", "idle"];
  } else if (session.subagents > 0) {
    [details, icon] = [`Working with ${session.subagents} subagent${session.subagents === 1 ? "" : "s"}`, "agents"];
  } else {
    [details, icon] =
      (session.state === "tool" && describeTool(session.tool, file)) || [thinkingMessage, "thinking"];
  }

  const title = privacy.showSessionTitle ? session.title : undefined;
  return {
    name: "Claude Code",
    details,
    state: title ?? (project && `Project ${project}`),
    timestamps: { start: session.startedAt },
    assets: { large_image: "claude-code", large_text: "Claude Code", small_image: icon, small_text: details },
  };
}
