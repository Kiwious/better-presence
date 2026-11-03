import { readdirSync, readFileSync } from "fs";
import { homedir } from "os";
import { basename, join } from "path";

const git = (verbs: string) => new RegExp(`^git(\\s+-\\S+\\s+\\S+)*\\s+(${verbs})\\b`);
const script = (names: string) => new RegExp(`^(yarn|npm|pnpm|bun)(\\s+run)?\\s+(${names})\\b`);

// First match wins, so a commit chained after a status counts as the commit
export const commandKinds: [RegExp, string][] = [
  [git("commit"), "Committing"],
  [git("push"), "Pushing"],
  [script("test|t"), "Running the tests"],
  [/^(npx\s+|python3?\s+-m\s+)?(mocha|jest|vitest|pytest|playwright)\b|^(cargo|go|dotnet)\s+test\b/, "Running the tests"],
  [script("lint|format|types|typecheck"), "Linting"],
  [/^(npx\s+)?(eslint|prettier|ruff|black)\b/, "Linting"],
  [script("build|compile|package|vsce"), "Building"],
  [/^(npx\s+)?(tsc|webpack|esbuild|vite\s+build)\b|^(make|gradle|mvn)\b|^(cargo|go|dotnet)\s+build\b/, "Building"],
  [/^(yarn|npm|pnpm|bun|pip3?|cargo|gem|brew|winget)\s+(install|add|i)\b/, "Installing packages"],
  [/^(rm|rmdir|del|Remove-Item)\b/i, "Deleting files"],
  [git("pull|fetch|merge|rebase"), "Syncing with git"],
  [/^git\b/, "Checking git"],
  [/^gh\b/, "Talking to GitHub"],
  [/^(docker|docker-compose|kubectl)\b/, "Running containers"],
];

// The kind of a command, never its text.
// shortcut: a separator inside a quoted string can split wrongly, then Clawd just says the wrong thing
export function commandKind(command?: string) {
  const parts = (command ?? "").split(/&&|\|\||[;|\n]/).map((part) => part.trim());
  return commandKinds.find(([match]) => parts.some((part) => match.test(part)))?.[1] ?? "Running a command";
}

// Only file names leave the PC: commands and searches can hold secrets, so they stay generic
function describeTool(name: string, input: { file_path?: string; command?: string }) {
  const file = input?.file_path ? basename(input.file_path) : "a file";
  if (name.startsWith("mcp__Claude_Browser__") || name.startsWith("mcp__claude-in-chrome__")) {
    return "Browsing the web";
  }
  if (name.startsWith("mcp__ccd_pr__")) {
    return "Talking to GitHub";
  }
  if (name.startsWith("mcp__ccd_")) {
    return "Managing sessions";
  }
  if (name.startsWith("mcp__")) {
    return "Using a connector";
  }
  switch (name) {
    case "Read":
      return `Reading ${file}`;
    case "Edit":
    case "Write":
    case "NotebookEdit":
      return `Editing ${file}`;
    case "Bash":
    case "PowerShell":
      return commandKind(input?.command);
    case "Grep":
    case "Glob":
      return "Searching the code";
    case "WebFetch":
    case "WebSearch":
      return "Browsing the web";
    case "Agent":
    case "SendMessage":
      return "Running a subagent";
    case "AskUserQuestion":
      return "Asking you something";
    case "EnterPlanMode":
    case "ExitPlanMode":
      return "Planning";
    case "Skill":
      return "Using a skill";
    case "Artifact":
      return "Working on a page";
    case "ToolSearch":
      return "Looking for a tool";
    case "Monitor":
    case "ScheduleWakeup":
    case "CronCreate":
      return "Setting a timer";
    default:
      return "Working";
  }
}

// Newest main-thread assistant step in transcript lines; the first line may be cut off
export function lastAction(transcript: string) {
  const lines = transcript.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const entry = JSON.parse(lines[i]);
      const content = entry.message?.content;
      if (entry.type !== "assistant" || entry.isSidechain || !Array.isArray(content)) {
        continue;
      }
      const step = content[content.length - 1];
      // The app's task list bookkeeping would hide the real action
      if (step?.name?.startsWith("mcp__ccd_turn__")) {
        continue;
      }
      return step?.type === "tool_use" ? describeTool(step.name, step.input) : "Thinking";
    } catch {
      // Cut-off or half-written line
    }
  }
  return undefined;
}

export interface AppSession {
  pid: number;
  sessionId: string;
  cwd: string;
  name?: string;
  status?: string;
  startedAt: number;
  updatedAt?: number;
}

function isAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// Claude Code writes one record per running session; the desktop app's are marked by entrypoint.
// Busy sessions come first, then the most recently active one.
export function findAppSessions(): AppSession[] {
  const dir = join(homedir(), ".claude", "sessions");
  const sessions: AppSession[] = [];
  let files: string[];
  try {
    files = readdirSync(dir).filter((file) => file.endsWith(".json"));
  } catch {
    return [];
  }
  for (const file of files) {
    try {
      const record = JSON.parse(readFileSync(join(dir, file), "utf8"));
      if (record.entrypoint === "claude-desktop" && isAlive(record.pid)) {
        sessions.push(record);
      }
    } catch {
      // Being written or removed right now, the next check sees it
    }
  }
  const rank = (session: AppSession) => (session.status === "busy" ? 1 : 0);
  return sessions.sort(
    (a, b) =>
      rank(b) - rank(a) ||
      (b.updatedAt ?? b.startedAt) - (a.updatedAt ?? a.startedAt),
  );
}

export function findAppSession(): AppSession | undefined {
  return findAppSessions()[0];
}
