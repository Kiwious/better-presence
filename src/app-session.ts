import { closeSync, fstatSync, openSync, readdirSync, readFileSync, readSync } from "fs";
import { homedir } from "os";
import { basename, join } from "path";

const TRANSCRIPT_TAIL_BYTES = 64 * 1024;

// Only file names leave the PC: commands and searches can hold secrets, so they stay generic
function describeTool(name: string, input: { file_path?: string }) {
  const file = input?.file_path ? basename(input.file_path) : "a file";
  switch (name) {
    case "Read":
      return `Reading ${file}`;
    case "Edit":
    case "Write":
    case "NotebookEdit":
      return `Editing ${file}`;
    case "Bash":
    case "PowerShell":
      return "Running a command";
    case "Grep":
    case "Glob":
      return "Searching the code";
    case "WebFetch":
    case "WebSearch":
      return "Browsing the web";
    case "Agent":
      return "Running a subagent";
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
      return step?.type === "tool_use" ? describeTool(step.name, step.input) : "Thinking";
    } catch {
      // Cut-off or half-written line
    }
  }
  return undefined;
}

// shortcut: only the last 64 KB, a huge last entry falls back to "Working"; read more if that shows up
export function currentAction(session: AppSession) {
  const project = session.cwd.replace(/[^a-zA-Z0-9]/g, "-");
  try {
    const fd = openSync(
      join(homedir(), ".claude", "projects", project, `${session.sessionId}.jsonl`),
      "r",
    );
    try {
      const { size } = fstatSync(fd);
      const length = Math.min(size, TRANSCRIPT_TAIL_BYTES);
      const tail = Buffer.alloc(length);
      readSync(fd, tail, 0, length, size - length);
      return lastAction(tail.toString("utf8"));
    } finally {
      closeSync(fd);
    }
  } catch {
    return undefined;
  }
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
export function findAppSession(): AppSession | undefined {
  const dir = join(homedir(), ".claude", "sessions");
  const sessions: AppSession[] = [];
  let files: string[];
  try {
    files = readdirSync(dir).filter((file) => file.endsWith(".json"));
  } catch {
    return undefined;
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
  )[0];
}
