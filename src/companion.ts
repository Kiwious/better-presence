import { Client } from "@nxenjs/discord-rich-presence";
import { createServer } from "net";
import { basename } from "path";
import { findAppSessions, type AppSession } from "./app-session";
import { assetText } from "./asset-text";
import { CLIENT_ID } from "./client-id";
import { petChatter, petMood, type Mood } from "./pet";
import { currentStep, modelName, readStats, type SessionStats } from "./session-stats";

const CHECK_MS = 1_000;
// Discord only displays about one update per 15 s
const SEND_MS = 15_000;
const PET_LINE_MS = 15_000;
const READY_TIMEOUT_MS = 5_000;

let client: Client | undefined;
let ready = false;
let connectingSince = 0;
let lastKey = "";
let lastSentAt = 0;
let lastMood: Mood | undefined;
let lastLineAt = 0;
let lastLine = "";
let showStep = false;

function disconnect() {
  const old = client;
  client = undefined;
  ready = false;
  lastKey = "";
  lastSentAt = 0;
  old?.destroy().catch(() => {});
}

function connect() {
  const next = new Client();
  client = next;
  ready = false;
  connectingSince = Date.now();
  next.once("ready", () => {
    if (client === next) {
      ready = true;
    }
  });
  next.on("error", () => {});
  next.on("close", () => {
    if (client === next) {
      disconnect();
    }
  });
  // Discord isn't running: try again on a later check
  next.login(CLIENT_ID).catch(() => {
    if (client === next) {
      disconnect();
    }
  });
}

function rotate(mood: Mood, session: AppSession, stats: SessionStats, others: number, folder?: string, action?: string) {
  if (mood !== lastMood || Date.now() - lastLineAt >= PET_LINE_MS) {
    lastMood = mood;
    lastLineAt = Date.now();
    showStep = !showStep;
    // A repeat would keep the same text on screen for another 15 s
    const previous = lastLine;
    for (let tries = 0; tries < 5 && lastLine === previous; tries++) {
      lastLine = petChatter(mood, Date.now() - session.startedAt, folder, session.name, action, stats, others);
    }
  }
}

function buildActivity(session: AppSession, others: number) {
  const busy = session.status === "busy";
  const idleMs = Date.now() - (session.updatedAt ?? session.startedAt);
  const mood = petMood(busy, idleMs);
  const folder = session.cwd.includes("scratch-workspaces")
    ? undefined
    : basename(session.cwd);
  const stats = readStats(session);
  const current = busy ? stats.action : undefined;
  rotate(mood, session, stats, others, folder, current);
  const action = busy ? (current ?? "Working") : "Waiting";
  const step = busy ? currentStep(stats) : undefined;
  const model = modelName(stats.model);
  return {
    name: "Claude Code",
    details: assetText(session.name ?? ""),
    // While there is a task list, the card takes turns between its step and the live action
    state: assetText(
      step && showStep
        ? `Step ${step.number} of ${step.total}: ${step.content}`
        : `${action}${folder ? ` in ${folder}` : ""}`,
    ),
    assets: {
      large_image: "claude-code",
      large_text: assetText(
        [model, stats.version && `Claude Code ${stats.version}`, stats.branch && `on ${stats.branch}`]
          .filter(Boolean)
          .join(" · "),
      ),
      small_image: "clawd",
      small_text: assetText(lastLine),
    },
    timestamps: {
      start: session.startedAt,
    },
  };
}

function check() {
  const sessions = findAppSessions();
  const session = sessions[0];
  if (!session) {
    disconnect();
    return;
  }
  if (!client) {
    connect();
    return;
  }
  if (!ready) {
    // Discord sometimes never answers the handshake, a new connection does get one
    if (Date.now() - connectingSince > READY_TIMEOUT_MS) {
      disconnect();
    }
    return;
  }
  const activity = buildActivity(session, sessions.length - 1);
  const key = JSON.stringify(activity);
  if (key !== lastKey && Date.now() - lastSentAt >= SEND_MS) {
    lastKey = key;
    lastSentAt = Date.now();
    client.setActivity(activity);
  }
}

// One companion at a time: a second start can't take this pipe and exits
createServer()
  .on("error", () => process.exit(0))
  .listen("\\\\.\\pipe\\better-presence-companion", () => {
    check();
    setInterval(() => {
      try {
        check();
      } catch {
        disconnect();
      }
    }, CHECK_MS);
  });
