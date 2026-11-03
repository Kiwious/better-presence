import { closeSync, fstatSync, openSync, readSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { commandKind, lastAction, type AppSession } from "./app-session";

interface PlanStep {
  content: string;
  status: string;
}

export interface SessionStats {
  prompts: number;
  edits: number;
  reads: number;
  commands: number;
  searches: number;
  commits: number;
  contextTokens: number;
  /** Times the context shrank, the app compacted the chat */
  compactions: number;
  /** Tool calls in a row that failed, and what the last one was doing */
  failures: number;
  failedAction?: string;
  /** The user stopped the turn */
  interrupted: boolean;
  /** How many tool calls of one kind in a row */
  streak: number;
  streakTool?: string;
  action?: string;
  model?: string;
  branch?: string;
  version?: string;
  steps: PlanStep[];
}

export function emptyStats(): SessionStats {
  return { prompts: 0, edits: 0, reads: 0, commands: 0, searches: 0, commits: 0, contextTokens: 0, compactions: 0, failures: 0, interrupted: false, streak: 0, steps: [] };
}

function applyPlan(stats: SessionStats, input: { items?: PlanStep[]; advance?: boolean; done?: number[]; start?: number }) {
  if (input.items) {
    stats.steps = input.items.map(({ content, status }) => ({ content, status }));
  }
  if (input.advance) {
    const current = stats.steps.findIndex((step) => step.status === "in_progress");
    if (current >= 0) {
      stats.steps[current].status = "completed";
    }
    const next = stats.steps.find((step) => step.status === "pending");
    if (next) {
      next.status = "in_progress";
    }
  }
  for (const number of input.done ?? []) {
    if (stats.steps[number - 1]) {
      stats.steps[number - 1].status = "completed";
    }
  }
  if (input.start && stats.steps[input.start - 1]) {
    stats.steps[input.start - 1].status = "in_progress";
  }
}

function countStreak(stats: SessionStats, kind: string) {
  stats.streak = stats.streakTool === kind ? stats.streak + 1 : 1;
  stats.streakTool = kind;
}

function applyTool(stats: SessionStats, name: string, input: any) {
  switch (name) {
    case "Edit":
    case "Write":
    case "NotebookEdit":
      stats.edits++;
      countStreak(stats, "edit");
      break;
    case "Read":
      stats.reads++;
      countStreak(stats, "read");
      break;
    case "Bash":
    case "PowerShell":
      stats.commands++;
      countStreak(stats, "command");
      if (commandKind(input.command) === "Committing") {
        stats.commits++;
      }
      break;
    case "Grep":
    case "Glob":
      stats.searches++;
      countStreak(stats, "search");
      break;
    case "mcp__ccd_turn__update_plan":
      applyPlan(stats, input);
      break;
    case "mcp__ccd_turn__wrap_up":
      stats.steps = [];
      break;
  }
}

// One transcript line. Message text is never kept, only counts and the task list
export function applyEntry(stats: SessionStats, entry: any) {
  if (entry.isSidechain) {
    return;
  }
  const content = entry.message?.content;
  if (entry.type === "user" && !entry.isMeta) {
    const parts: any[] = Array.isArray(content) ? content : [];
    const typed = typeof content === "string" || parts.some((part) => part.type === "text");
    if (typed) {
      stats.interrupted = parts.some((part) => part.text?.startsWith("[Request interrupted"));
      if (stats.interrupted) {
        stats.failures = 0;
      } else {
        stats.prompts++;
      }
    }
    for (const part of parts) {
      if (part.type === "tool_result") {
        stats.failures = part.is_error ? stats.failures + 1 : 0;
        stats.failedAction = part.is_error ? stats.action : undefined;
      }
    }
  }
  if (entry.type !== "assistant") {
    return;
  }
  stats.version = entry.version ?? stats.version;
  stats.model = entry.message?.model ?? stats.model;
  if (entry.gitBranch && entry.gitBranch !== "HEAD") {
    stats.branch = entry.gitBranch;
  }
  const usage = entry.message?.usage;
  if (usage) {
    const tokens =
      (usage.input_tokens ?? 0) +
      (usage.cache_read_input_tokens ?? 0) +
      (usage.cache_creation_input_tokens ?? 0);
    if (stats.contextTokens >= 50_000 && tokens < stats.contextTokens / 2) {
      stats.compactions++;
    }
    stats.contextTokens = tokens;
  }
  for (const part of Array.isArray(content) ? content : []) {
    if (part.type === "tool_use") {
      applyTool(stats, part.name, part.input ?? {});
    }
  }
}

const cache = new Map<string, { offset: number; stats: SessionStats }>();

// Reads only what was appended since the last check, these files reach many MB
export function readStats(session: AppSession) {
  let entry = cache.get(session.sessionId);
  if (!entry) {
    entry = { offset: 0, stats: emptyStats() };
    cache.set(session.sessionId, entry);
  }
  const project = session.cwd.replace(/[^a-zA-Z0-9]/g, "-");
  try {
    const fd = openSync(
      join(homedir(), ".claude", "projects", project, `${session.sessionId}.jsonl`),
      "r",
    );
    try {
      const { size } = fstatSync(fd);
      const fresh = Buffer.alloc(Math.max(size - entry.offset, 0));
      readSync(fd, fresh, 0, fresh.length, entry.offset);
      const end = fresh.lastIndexOf(10);
      if (end >= 0) {
        for (const line of fresh.toString("utf8", 0, end).split("\n")) {
          try {
            applyEntry(entry.stats, JSON.parse(line));
            entry.stats.action = lastAction(line) ?? entry.stats.action;
          } catch {
            // Not a JSON line, the next one is
          }
        }
        entry.offset += end + 1;
      }
    } finally {
      closeSync(fd);
    }
  } catch {
    // No transcript yet: keep what we have
  }
  return entry.stats;
}

export function modelName(model?: string) {
  const match = model?.match(/^claude-([a-z]+)-(\d+)-(\d+)/);
  return match
    ? `${match[1][0].toUpperCase()}${match[1].slice(1)} ${match[2]}.${match[3]}`
    : model;
}

export function currentStep(stats: SessionStats) {
  const index = stats.steps.findIndex((step) => step.status === "in_progress");
  return index < 0
    ? undefined
    : { number: index + 1, total: stats.steps.length, content: stats.steps[index].content };
}
