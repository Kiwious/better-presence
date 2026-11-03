import { spawn } from "child_process";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "fs";
import { dirname, join } from "path";

const DIR = join(process.env.LOCALAPPDATA ?? "", "better-presence");
// Stays on this PC: the desktop pet (clawd-pet) reads it for its speech bubble and animation.
// The pet quits when this file disappears, which happens when the Claude app has closed.
const STATE_FILE = join(DIR, "clawd-state.json");
// Optional, holds the path of the pet's start-clawd.vbs. Without it the pet isn't started.
const START_FILE = join(DIR, "clawd-pet.txt");
// The pet takes a file this old as a stopped companion after 15 s
const BEAT_MS = 5_000;

let lastState = "";
let lastWriteAt = 0;

// The pet's activity tokens for the actions `describeTool` names
export function petToken(action?: string) {
  if (action?.startsWith("Editing")) {
    return "edit";
  }
  if (action?.startsWith("Reading") || action?.startsWith("Searching")) {
    return "read";
  }
  if (action === "Running a command") {
    return "bash";
  }
  if (action === "Browsing the web") {
    return "web";
  }
  return action === "Running a subagent" ? "task" : "think";
}

export function writePetState(token: string, line: string) {
  const state = JSON.stringify({ token, line });
  if (state === lastState && Date.now() - lastWriteAt < BEAT_MS) {
    return;
  }
  try {
    mkdirSync(dirname(STATE_FILE), { recursive: true });
    // Renamed into place, so the pet never reads a half-written file
    writeFileSync(`${STATE_FILE}.tmp`, state);
    renameSync(`${STATE_FILE}.tmp`, STATE_FILE);
    lastState = state;
    lastWriteAt = Date.now();
  } catch {
    // The pet is optional, and the next check tries again
  }
}

// A second start is harmless, the pet allows only one of itself
export function startPet() {
  try {
    const starter = readFileSync(START_FILE, "utf8").trim();
    spawn("wscript", [starter], { detached: true, stdio: "ignore", windowsHide: true })
      .on("error", () => {})
      .unref();
  } catch {
    // No pet set up on this PC
  }
}

export function clearPetState() {
  lastState = "";
  rmSync(STATE_FILE, { force: true });
}
