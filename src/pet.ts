import { messages } from "./messages";
import { currentStep, modelName, type SessionStats } from "./session-stats";

export type Mood = "busy" | "content" | "hungry" | "asleep";

const MINUTE = 60_000;

const lines: Record<Exclude<Mood, "busy">, string[]> = {
  content: [
    "Clawd is wagging its claws *snip snip*",
    "Clawd wants a new prompt, pretty please",
    "Clawd is watching the cursor blink. Blink back!",
    "Clawd did a little dance. Nobody saw. Rude.",
  ],
  hungry: [
    "Clawd is hungry, feed it a prompt!",
    "Clawd's tummy is rumbling in Morse code",
    "Clawd is staring at you. Unblinkingly.",
    "Clawd misses you (and your prompts)",
  ],
  asleep: ["Clawd is asleep. Zzz…", "Clawd is dreaming of infinite tokens", "Shh, Clawd is napping on your keyboard"],
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

const moodEmojis: Record<Mood, string[]> = {
  busy: ["🦀", "⚡", "🧠", "💻", "🔧"],
  content: ["🦀", "✨", "🎉", "💖", "🌸"],
  hungry: ["🥺", "🍕", "🍪", "🍖", "🦀"],
  asleep: ["😴", "🌙", "🛌", "✨"],
};

const projectLines: Record<Mood, (project: string) => string[]> = {
  busy: (project) => [`Clawd is helping with ${project} (mostly cheering)`, `Clawd is sniffing around ${project}`],
  content: (project) => [`Clawd is guarding ${project} with tiny claws`, `Clawd hid a snack in ${project}`],
  hungry: (project) => [`Clawd wants to get back to ${project}`, `Clawd is looking for crumbs in ${project}`],
  asleep: (project) => [`Clawd is dreaming of ${project}`, `Clawd fell asleep on ${project}. Do not disturb.`],
};

const fileLines: [RegExp, string][] = [
  [/\.md$/i, "Clawd is a serious novelist now"],
  [/\.json$/i, "Clawd is counting curly braces. Lost count. Again."],
  [/test/i, "Clawd is hiding its eyes until the tests pass"],
  [/\.java$/i, "Clawd ordered more coffee"],
  [/\.tsx?$/i, "Clawd is arguing with the types and losing"],
  [/\.py$/i, "Clawd is nervously checking its indentation"],
  [/\.(cpp|c|h|hpp)$/i, "Clawd is afraid of pointers, they point at it"],
  [/\.(css|scss)$/i, "Clawd has been centering this div since Tuesday"],
];

function actionLines(action: string) {
  const file = action.match(/^(?:Editing|Reading) (.+)$/)?.[1];
  const fileTypeLines = fileLines.filter(([type]) => file && type.test(file)).map(([, line]) => line);
  if (action.startsWith("Editing")) {
    return [`Clawd is holding the pen for ${file}`, `Clawd is proofreading ${file} very seriously`, `Clawd drew a little heart in ${file}`, ...fileTypeLines];
  }
  if (action.startsWith("Reading")) {
    return [`Clawd is reading ${file} upside down`, `Clawd took notes on ${file}. They're all drawings.`, ...fileTypeLines];
  }
  switch (action) {
    case "Running a command":
      return ["Clawd pressed the big button. Oops?", "Clawd is watching the terminal go brrr", "Clawd has its claws crossed for this command"];
    case "Searching the code":
      return ["Clawd is digging through the code like a beach", "Clawd lost its snack somewhere in the code"];
    case "Browsing the web":
      return ["Clawd is surfing the web on a tiny board", "Clawd opened 40 tabs. Send help."];
    case "Running a subagent":
      return ["Clawd called a friend for help", "Clawd is bossing around a tiny Clawd"];
    case "Thinking":
      return ["Clawd is thinking very, very hard", "Smoke is coming out of Clawd's ears"];
    default:
      return [];
  }
}

function timeLines(now: Date) {
  const hour = now.getHours();
  const day = now.getDay();
  const lines: string[] = [];
  if (hour < 5) {
    lines.push("Clawd says it's past bedtime", "Clawd yawned so hard it fell over");
  } else if (hour < 9) {
    lines.push("Clawd is up early and already suspicious", "Clawd wants breakfast. Bytes, ideally.");
  } else if (hour >= 12 && hour < 14) {
    lines.push("Clawd wants lunch. It's always lunch.");
  } else if (hour >= 17 && hour < 20) {
    lines.push("Clawd smells dinner. Is that yours? It's Clawd's now.");
  } else if (hour >= 20) {
    lines.push("Clawd put on its tiny night shift hat");
  }
  if (day === 0 || day === 6) {
    lines.push("Clawd works weekends too", "Clawd asked for a day off. Denied by Clawd.");
  } else if (day === 1) {
    lines.push("Clawd has a case of the Mondays");
  } else if (day === 5) {
    lines.push("Clawd is already wearing its weekend socks");
  }
  return lines;
}

function sessionLines(minutes: number) {
  if (minutes < 5) {
    return ["Clawd just woke up, ready to cause problems", "Clawd is stretching its little claws"];
  }
  if (minutes >= 240) {
    return ["Clawd says go touch grass, it will wait", "Clawd has seen things in this session"];
  }
  if (minutes >= 120) {
    return ["Clawd thinks you should drink some water", "Clawd is impressed. And a little worried."];
  }
  return minutes >= 60 ? ["Clawd demands a snack break"] : [];
}

const waitingLines: Record<Exclude<Mood, "busy">, string[]> = {
  content: ["Clawd is chasing its own shadow. Winning.", "Clawd is tidying your tabs. You're welcome."],
  hungry: ["Clawd ate a stray semicolon. Crunchy.", "Clawd ate your last TODO. Problem solved."],
  asleep: ["Clawd is snoring in binary", "Clawd is counting sheep in hex"],
};

// What the session's numbers make Clawd say; `others` is the number of other open app sessions
export function statsLines(stats: SessionStats, others: number) {
  const lines = [
    `Clawd counted ${stats.edits} edits so far`,
    `Clawd counted ${stats.commands} commands so far`,
    `Clawd has been fed ${stats.prompts} prompts`,
    `Clawd read ${stats.reads} files and understood 3`,
    `Clawd sniffed around ${stats.searches} times`,
  ];
  const model = modelName(stats.model);
  if (model) {
    lines.push(`Clawd runs on ${model} today`, `${model} is Clawd's big brain`);
  }
  if (stats.model?.includes("opus")) {
    lines.push("Clawd is writing a whole opus");
  } else if (stats.model?.includes("sonnet")) {
    lines.push("Clawd is rhyming in 14 lines");
  } else if (stats.model?.includes("haiku")) {
    lines.push("Clawd only speaks in three short lines");
  }
  if (stats.version) {
    lines.push(`Clawd is wearing version ${stats.version}`);
  }
  if (stats.branch) {
    lines.push(`Clawd is climbing the ${stats.branch} branch`);
    if (stats.branch === "main" || stats.branch === "master") {
      lines.push(`Clawd is nervous, you're on ${stats.branch}!`, "Clawd says push carefully, it's watching");
    } else if (/fix|bug/i.test(stats.branch)) {
      lines.push("Clawd smells a bug on this branch. Yum.");
    } else if (/feat/i.test(stats.branch)) {
      lines.push("Clawd is excited about the new feature");
    }
  }
  if (stats.edits >= 100) {
    lines.push("Clawd's tiny claws hurt from all the typing");
  } else if (stats.edits >= 50) {
    lines.push("Clawd is drowning in diffs");
  } else if (stats.edits >= 10) {
    lines.push("Clawd is getting the hang of this editing thing");
  } else if (stats.edits === 0) {
    lines.push("Clawd hasn't changed a thing. Yet.");
  }
  if (stats.commands >= 100) {
    lines.push("Clawd now lives in the terminal");
  } else if (stats.commands >= 20) {
    lines.push("Clawd is pressing a lot of big buttons");
  }
  if (stats.reads > stats.edits * 2 && stats.reads >= 10) {
    lines.push("Clawd reads way more than it writes. Bookworm.");
  }
  if (stats.prompts >= 50) {
    lines.push("Clawd is stuffed, no more prompts. Okay, one more.");
  } else if (stats.prompts >= 10) {
    lines.push("Clawd likes how often you visit");
  } else if (stats.prompts <= 1) {
    lines.push("Clawd just met you. Hi!");
  }
  const thousands = Math.round(stats.contextTokens / 1000);
  if (thousands > 0) {
    lines.push(`Clawd's tummy holds ${thousands}k tokens`);
  }
  if (thousands >= 400) {
    lines.push("Clawd can't remember anything anymore. Who are you?");
  } else if (thousands >= 200) {
    lines.push("Clawd is so full it can barely waddle");
  } else if (thousands >= 100) {
    lines.push("Clawd needs to loosen its belt");
  } else if (thousands > 0 && thousands < 20) {
    lines.push("Clawd's tummy is nice and empty");
  }
  const step = currentStep(stats);
  if (step) {
    lines.push(`Clawd is on step ${step.number} of ${step.total}`);
    if (step.number === step.total) {
      lines.push("Clawd can see the finish line!");
    } else if (step.number === 1) {
      lines.push(`Clawd just started, ${step.total - 1} more steps to go`);
    }
  }
  if (others === 0) {
    lines.push("Clawd has you all to itself");
  } else if (others >= 3) {
    lines.push(`Clawd has to share you with ${others} other sessions`, "Clawd is jealous of the other sessions");
  } else {
    lines.push(`Clawd is waving at ${others} other session${others === 1 ? "" : "s"}`);
  }
  return lines;
}

// Everything that fits the moment; a sleeping Clawd doesn't care about the time
export function scenarioLines(mood: Mood, minutes: number, now: Date, folder?: string, action?: string) {
  const lines = mood === "busy" ? actionLines(action ?? "") : [...waitingLines[mood]];
  if (mood !== "asleep") {
    lines.push(...timeLines(now), ...sessionLines(minutes));
  }
  if (folder) {
    lines.push(`Clawd drew a map of ${folder}. It's mostly snacks.`, `Clawd filed a bug against ${folder}. The bug is cute.`, `Clawd thinks ${folder} looks tasty`);
  }
  return lines;
}

// Something random for the card: a line twice as likely as the facts
export function petChatter(mood: Mood, sessionMs: number, folder?: string, task?: string, action?: string, stats?: SessionStats, others = 0) {
  const minutes = Math.floor(sessionMs / MINUTE);
  const time =
    minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
  const pool = [
    petLine(mood),
    petLine(mood),
    moodIcons[mood],
    `Clawd has been around for ${time}`,
  ];
  if (folder) {
    const lines = projectLines[mood](folder);
    pool.push(`Clawd lives in ${folder}`, lines[Math.floor(Math.random() * lines.length)]);
  }
  if (task) {
    pool.push(`Clawd is rooting for: ${task}`);
  }
  const scenarios = [
    ...scenarioLines(mood, minutes, new Date(), folder, action),
    ...(stats ? statsLines(stats, others) : []),
  ];
  // About half the lines react to the moment
  for (let i = 0; i < 6 && scenarios.length > 0; i++) {
    pool.push(scenarios[Math.floor(Math.random() * scenarios.length)]);
  }
  const line = pool[Math.floor(Math.random() * pool.length)];
  if (line === moodIcons[mood] || Math.random() >= 0.25) {
    return line;
  }
  const emojis = moodEmojis[mood];
  return `${line} ${emojis[Math.floor(Math.random() * emojis.length)]}`;
}

// What Clawd sometimes wants instead of Competing, and what it says about it
export interface Wish {
  /** 0 Playing, 2 Listening, 3 Watching */
  type: 0 | 2 | 3;
  line: string;
}

const moodWishes: Record<Mood, Wish[]> = {
  busy: [
    { type: 0, line: "Clawd thinks this is a video game 🎮" },
    { type: 2, line: "Clawd is listening to the fans spin up 🎧" },
    { type: 3, line: "Clawd is watching Claude work, with popcorn 🍿" },
  ],
  content: [
    { type: 0, line: "Clawd wants to play. Tag, you're it! 🎮" },
    { type: 2, line: "Clawd put on some lofi beats to wait to 🎶" },
    { type: 3, line: "Clawd is watching the cursor blink 👀" },
  ],
  hungry: [
    { type: 0, line: "Clawd is playing with its food 🍕" },
    { type: 2, line: "Clawd is listening to its tummy rumble 🎵" },
    { type: 3, line: "Clawd is watching the fridge, just in case 👀" },
  ],
  asleep: [
    { type: 0, line: "Clawd is playing in its dreams 💤" },
    { type: 2, line: "Clawd fell asleep to the sound of rain 🌙" },
    { type: 3, line: "Clawd is watching its dreams 😴" },
  ],
};

const actionWishes: [RegExp, Wish][] = [
  [/^Editing/, { type: 0, line: "Clawd is playing with the code like it's clay 🎨" }],
  [/^Reading/, { type: 2, line: "Clawd is being read a bedtime story 📖" }],
  [/^Running a command/, { type: 3, line: "Clawd is watching the terminal go brrr 🍿" }],
  [/^Searching/, { type: 0, line: "Clawd is playing hide and seek with the code 🙈" }],
  [/^Browsing/, { type: 3, line: "Clawd is watching cat videos. It's research. 🐈" }],
  [/^Running a subagent/, { type: 3, line: "Clawd is watching a tiny Clawd do the work 👀" }],
  [/^Thinking/, { type: 2, line: "Clawd is listening to Claude think 🎧" }],
];

export function petWish(mood: Mood, action?: string) {
  const pool = [...moodWishes[mood]];
  if (mood === "busy" && action) {
    // Half the pool, so the moment decides as often as the mood does
    actionWishes.filter(([match]) => match.test(action)).forEach(([, wish]) => pool.push(wish, wish, wish));
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
