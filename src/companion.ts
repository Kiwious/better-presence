import { Client } from "@nxenjs/discord-rich-presence";
import { createServer } from "net";
import { basename } from "path";
import { currentAction, findAppSession, type AppSession } from "./app-session";
import { assetText } from "./asset-text";
import { CLIENT_ID } from "./client-id";
import { petLine, petMood } from "./pet";

const CHECK_MS = 5_000;
// Discord allows about one activity update per 15 s
const MESSAGE_MS = 15_000;
const READY_TIMEOUT_MS = 5_000;

let client: Client | undefined;
let ready = false;
let connectingSince = 0;
let lastKey = "";
let lastSentAt = 0;

function disconnect() {
  const old = client;
  client = undefined;
  ready = false;
  lastKey = "";
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

function activityLine(session: AppSession, busy: boolean) {
  const verb = busy ? (currentAction(session) ?? "Working") : "Waiting";
  return assetText(
    session.cwd.includes("scratch-workspaces")
      ? verb
      : `${verb} in ${basename(session.cwd)}`,
  );
}

function send(session: AppSession) {
  const busy = session.status === "busy";
  const idleMs = Date.now() - (session.updatedAt ?? session.startedAt);
  const mood = petMood(busy, idleMs);
  client?.setActivity({
    name: "Claude Code",
    details: activityLine(session, busy),
    state: petLine(mood),
    assets: {
      large_image: "claude-code",
      large_text: `Clawd is ${mood}`,
      small_image: "clawd",
      small_text: assetText(session.name ?? ""),
    },
    timestamps: {
      start: session.startedAt,
    },
  });
}

function check() {
  const session = findAppSession();
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
  const key = `${session.pid}|${session.status}|${session.name}|${session.cwd}`;
  if (key !== lastKey || Date.now() - lastSentAt >= MESSAGE_MS) {
    lastKey = key;
    lastSentAt = Date.now();
    send(session);
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
