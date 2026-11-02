import { Client } from "@nxenjs/discord-rich-presence";
import { createServer } from "net";
import { basename } from "path";
import { findAppSessions, type AppSession } from "./app-session";
import { assetText } from "./asset-text";
import { CLIENT_ID } from "./client-id";
import { findOpenChat } from "./open-chat";
import { petChatter, petMood, petWish, type Mood, type Wish } from "./pet";
import { currentStep, modelName, readStats, type SessionStats } from "./session-stats";

const CHECK_MS = 1_000;
// Discord only displays about one update per 15 s
const SEND_MS = 15_000;
const PET_LINE_MS = 15_000;
// Per new line, so Clawd wants something else about every 2.5 min, for a minute
const WISH_CHANCE = 0.1;
const WISH_MS = 60_000;
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
let wish: Wish | undefined;
let wishUntil = 0;

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
    // A wish doesn't outlive the mood it came from
    if (mood !== lastMood || Date.now() >= wishUntil) {
      wish = undefined;
    }
    if (!wish && Math.random() < WISH_CHANCE) {
      wish = petWish(mood, action);
      wishUntil = Date.now() + WISH_MS;
    }
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
    // Discord lists Competing above a running game, only its own stream stays on top
    type: wish?.type ?? (5 as const),
    details: assetText(session.name ?? ""),
    // While there is a task list, the card takes turns between its step and the live action
    state: assetText(
      step && showStep
        ? `Step ${step.number} of ${step.total}: ${step.content}`
        : `${action}${folder ? ` in ${folder}` : ""}`,
    ),
    assets: {
      large_image: "claude-code",
      large_text: assetText(model ? `${model} · Claude Code` : "Claude Code"),
      small_image: "clawd",
      small_text: assetText(wish?.line ?? lastLine),
    },
    timestamps: {
      start: session.startedAt,
    },
  };
}

function check() {
  const sessions = findAppSessions();
  const session = sessions.length > 0 ? findOpenChat(sessions) : undefined;
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
  const others = sessions.filter((other) => other.sessionId !== session.sessionId).length;
  const activity = buildActivity(session, others);
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
