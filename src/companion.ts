import { Client } from "@nxenjs/discord-rich-presence";
import { execFile } from "child_process";
import { createServer } from "net";
import { basename } from "path";
import { findAppSessions, type AppSession } from "./app-session";
import { assetText } from "./asset-text";
import { CLIENT_ID } from "./client-id";
import { findOpenChat } from "./open-chat";
import { limitReset } from "./plan-usage";
import { ProjectClock } from "./project-clock";
import { petChatter, petMood, petReaction, petWish, type Mood, type Wish } from "./pet";
import { parsePetCount, petButtons, readPetUrl } from "./pet-button";
import { clearPetState, petToken, startPet, writePetState } from "./pet-state";
import { currentStep, modelName, readStats, type SessionStats } from "./session-stats";

const CHECK_MS = 1_000;
// Discord only displays about one update per 15 s
const SEND_MS = 15_000;
const PET_LINE_MS = 15_000;
// Per new line, so Clawd wants something else about every 2.5 min, for a minute
const WISH_CHANCE = 0.1;
const WISH_MS = 60_000;
const READY_TIMEOUT_MS = 5_000;
const APP_CHECK_MS = 2_000;
// How long the pet celebrates a finished turn
const PET_DONE_MS = 8_000;
// User wished 10 s; with one send per 15 s a shorter span could fall between two sends and never show
const PROJECT_TIME_MS = 15_000;
const projectClock = new ProjectClock();
const PET_CHECK_MS = 5_000;
const PET_CHECK_TIMEOUT_MS = 4_000;
// Long enough to reach Discord, and how often someone pressing the button can make Clawd react
const PET_HOLD_MS = 30_000;

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
let appOpen = false;
let appCheckedAt = 0;
let appKnown = false;
let petStarted = false;
let wasBusy = false;
let petDoneUntil = 0;
const petUrl = readPetUrl();
let petCount: number | undefined;
let petsCheckedAt = 0;
let petted = false;
let petHeldUntil = 0;

// Discord never tells anyone about a button press, so ask the worker the button opens
function checkPets() {
  if (!petUrl || Date.now() - petsCheckedAt < PET_CHECK_MS) {
    return;
  }
  petsCheckedAt = Date.now();
  fetch(`${petUrl}/count`, { signal: AbortSignal.timeout(PET_CHECK_TIMEOUT_MS) })
    .then((response) => response.json())
    .then((body) => {
      const count = parsePetCount(body);
      if (count === undefined) {
        return;
      }
      // The first answer only says where to count from
      if (petCount !== undefined && count > petCount && Date.now() >= petHeldUntil) {
        petted = true;
      }
      petCount = count;
    })
    .catch(() => {
      // Offline or not deployed, the next check tries again
    });
}

// Only the app's main process loads this module, a session's own claude.exe doesn't.
// That process lives until the app really quits, so this also finds it hidden in the tray.
function checkAppOpen() {
  if (Date.now() - appCheckedAt < APP_CHECK_MS) {
    return;
  }
  appCheckedAt = Date.now();
  execFile(
    "tasklist",
    ["/FI", "IMAGENAME eq claude.exe", "/FI", "MODULES eq claude-native-binding.node", "/NH", "/FO", "CSV"],
    { windowsHide: true },
    (error, stdout) => {
      // A failed check says nothing, and shouldn't make the pet quit
      if (!error) {
        appOpen = /claude\.exe/i.test(stdout);
        appKnown = true;
      }
    },
  );
}

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
  if (petted) {
    petted = false;
    wish = undefined;
    lastLine = petReaction(mood);
    petHeldUntil = Date.now() + PET_HOLD_MS;
    petDoneUntil = Date.now() + PET_DONE_MS;
  }
  if (Date.now() < petHeldUntil) {
    lastMood = mood;
    return;
  }
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
      lastLine = petChatter(mood, Date.now() - session.startedAt, folder, session.name, action, stats, others, petCount);
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
  const reset = limitReset(busy);
  const projectStart = projectClock.start(session.cwd, Date.now());
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
    // Discord shows one timer: the countdown to the 5h limit reset, at the start of every minute the project time
    timestamps:
      reset && Date.now() % 60_000 >= PROJECT_TIME_MS ? { end: reset } : { start: projectStart },
    buttons: petButtons(petUrl),
  };
}

// The pet says what the small icon says, also while Discord isn't running
function publishPetState(session: AppSession, line: string) {
  const busy = session.status === "busy";
  if (wasBusy && !busy) {
    petDoneUntil = Date.now() + PET_DONE_MS;
  }
  wasBusy = busy;
  const idleToken = Date.now() < petDoneUntil ? "done" : "idle";
  writePetState(busy ? petToken(readStats(session).action) : idleToken, line);
}

function check() {
  const sessions = findAppSessions();
  // Sessions say nothing about the app: it ends idle ones while staying open, and ending its task can leave one behind
  checkAppOpen();
  // Right after a restart of the companion: a running pet would take "not known yet" for a closed app
  if (!appKnown) {
    return;
  }
  const session = appOpen ? findOpenChat(sessions) : undefined;
  if (!session) {
    projectClock.start(undefined, Date.now());
    disconnect();
    if (appOpen) {
      writePetState("idle", "");
    } else {
      clearPetState();
    }
  }
  // Once per opening, so a pet quit from its menu stays away until the app opens again
  if (appOpen && !petStarted) {
    startPet();
  }
  petStarted = appOpen;
  if (!session) {
    return;
  }
  checkPets();
  const others = sessions.filter((other) => other.sessionId !== session.sessionId).length;
  const activity = buildActivity(session, others);
  publishPetState(session, activity.assets.small_text);
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
