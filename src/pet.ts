import { messages } from "./messages";

export type Mood = "busy" | "content" | "hungry" | "asleep";

const MINUTE = 60_000;

const lines: Record<Exclude<Mood, "busy">, string[]> = {
  content: [
    "Clawd is wagging its claws",
    "Clawd wants a new prompt",
    "Clawd is watching the cursor blink",
    "Clawd did a little dance",
  ],
  hungry: [
    "Clawd is hungry, feed it a prompt!",
    "Clawd's tummy is rumbling",
    "Clawd is staring at you",
    "Clawd misses you",
  ],
  asleep: ["Clawd is asleep. Zzz…", "Clawd is dreaming of tokens", "Shh, Clawd is napping"],
};

export function petMood(busy: boolean, idleMs: number): Mood {
  if (busy) {
    return "busy";
  }
  if (idleMs < 10 * MINUTE) {
    return "content";
  }
  return idleMs < 60 * MINUTE ? "hungry" : "asleep";
}

const moodIcons: Record<Mood, string> = {
  busy: "🔨",
  content: "😊",
  hungry: "🍖",
  asleep: "💤",
};

// Something random for the card: a line twice as likely as the facts
export function petChatter(mood: Mood, sessionMs: number, folder?: string) {
  const minutes = Math.floor(sessionMs / MINUTE);
  const time =
    minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
  const pool = [
    petLine(mood),
    petLine(mood),
    `Mood: ${moodIcons[mood]} ${mood}`,
    `Clawd has been around for ${time}`,
  ];
  if (folder) {
    pool.push(`Clawd lives in ${folder}`);
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

export function petLine(mood: Mood) {
  const pool =
    mood === "busy"
      ? messages.map((message) => `Clawd is ${message.toLowerCase()}`)
      : lines[mood];
  return pool[Math.floor(Math.random() * pool.length)];
}
