import { messages } from "./messages";
import { currentStep, modelName, type SessionStats } from "./session-stats";

export type Mood = "busy" | "content" | "hungry" | "asleep";

const MINUTE = 60_000;
// Clawd mostly says "I", and sometimes talks about itself by name
const NAME_CHANCE = 0.2;

const lines: Record<Exclude<Mood, "busy">, string[]> = {
  content: [
    "I'm wagging my claws *snip snip*",
    "A new prompt, pretty please?",
    "I'm watching the cursor blink. Blink back!",
    "Clawd did a little dance. Nobody saw. Rude.",
  ],
  hungry: [
    "I'm hungry, feed me a prompt!",
    "My tummy is rumbling in Morse code",
    "Clawd is staring at you. Unblinkingly.",
    "I miss you (and your prompts)",
  ],
  asleep: ["Clawd is asleep. Zzz…", "I'm dreaming of infinite tokens", "Shh, I'm napping on your keyboard"],
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
  busy: (project) => [`I'm helping with ${project} (mostly cheering)`, `I'm sniffing around ${project}`],
  content: (project) => [`I'm guarding ${project} with tiny claws`, `I hid a snack in ${project}`],
  hungry: (project) => [`I want to get back to ${project}`, `Clawd is looking for crumbs in ${project}`],
  asleep: (project) => [`Clawd is dreaming of ${project}`, `I fell asleep on ${project}. Do not disturb.`],
};

const fileLines: [RegExp, string][] = [
  [/\.md$/i, "I'm a serious novelist now"],
  [/\.json$/i, "I'm counting curly braces. Lost count. Again."],
  [/test/i, "I'm hiding my eyes until the tests pass"],
  [/\.java$/i, "Clawd ordered more coffee"],
  [/\.tsx?$/i, "I'm arguing with the types and losing"],
  [/\.py$/i, "I'm nervously checking my indentation"],
  [/\.(cpp|c|h|hpp)$/i, "I'm afraid of pointers, they point at me"],
  [/\.(css|scss)$/i, "I've been centering this div since Tuesday"],
];

function actionLines(action: string) {
  const file = action.match(/^(?:Editing|Reading) (.+)$/)?.[1];
  const fileTypeLines = fileLines.filter(([type]) => file && type.test(file)).map(([, line]) => line);
  if (action.startsWith("Editing")) {
    return [`I'm holding the pen for ${file}`, `I'm proofreading ${file} very seriously`, `Clawd drew a little heart in ${file}`, ...fileTypeLines];
  }
  if (action.startsWith("Reading")) {
    return [`I'm reading ${file} upside down`, `I took notes on ${file}. They're all drawings.`, ...fileTypeLines];
  }
  switch (action) {
    case "Running a command":
      return ["I pressed the big button. Oops?", "I'm watching the terminal go brrr", "I have my claws crossed for this command"];
    case "Searching the code":
      return ["I'm digging through the code like a beach", "I lost my snack somewhere in the code"];
    case "Browsing the web":
      return ["I'm surfing the web on a tiny board", "I opened 40 tabs. Send help."];
    case "Running a subagent":
      return ["I called a friend for help", "Clawd is bossing around a tiny Clawd"];
    case "Thinking":
      return ["I'm thinking very, very hard", "Smoke is coming out of my ears"];
    default:
      return [];
  }
}

function timeLines(now: Date) {
  const hour = now.getHours();
  const day = now.getDay();
  const lines: string[] = [];
  if (hour < 5) {
    lines.push("Clawd says it's past bedtime", "I yawned so hard I fell over");
  } else if (hour < 9) {
    lines.push("I'm up early and already suspicious", "I want breakfast. Bytes, ideally.");
  } else if (hour >= 12 && hour < 14) {
    lines.push("I want lunch. It's always lunch.");
  } else if (hour >= 17 && hour < 20) {
    lines.push("I smell dinner. Is that yours? It's mine now.");
  } else if (hour >= 20) {
    lines.push("I put on my tiny night shift hat");
  }
  if (day === 0 || day === 6) {
    lines.push("Clawd works weekends too", "I asked for a day off. Denied by me.");
  } else if (day === 1) {
    lines.push("I have a case of the Mondays");
  } else if (day === 5) {
    lines.push("I'm already wearing my weekend socks");
  }
  return lines;
}

function sessionLines(minutes: number) {
  if (minutes < 5) {
    return ["I just woke up, ready to cause problems", "I'm stretching my little claws"];
  }
  if (minutes >= 240) {
    return ["Go touch grass, I'll wait", "I have seen things in this session"];
  }
  if (minutes >= 120) {
    return ["You should drink some water", "I'm impressed. And a little worried."];
  }
  return minutes >= 60 ? ["I demand a snack break"] : [];
}

const waitingLines: Record<Exclude<Mood, "busy">, string[]> = {
  content: ["I'm chasing my own shadow. Winning.", "I'm tidying your tabs. You're welcome."],
  hungry: ["I ate a stray semicolon. Crunchy.", "Clawd ate your last TODO. Problem solved."],
  asleep: ["Clawd is snoring in binary", "I'm counting sheep in hex"],
};

// What the session's numbers make Clawd say; `others` is the number of other open app sessions
export function statsLines(stats: SessionStats, others: number) {
  const lines = [
    `Clawd counted ${stats.edits} edits so far`,
    `I counted ${stats.commands} commands so far`,
    `I've been fed ${stats.prompts} prompts`,
    `I read ${stats.reads} files and understood 3`,
    `I sniffed around ${stats.searches} times`,
  ];
  const model = modelName(stats.model);
  if (model) {
    lines.push(`Clawd runs on ${model} today`, `${model} is my big brain`);
  }
  if (stats.model?.includes("opus")) {
    lines.push("I'm writing a whole opus");
  } else if (stats.model?.includes("sonnet")) {
    lines.push("I'm rhyming in 14 lines");
  } else if (stats.model?.includes("haiku")) {
    lines.push("I only speak in three short lines");
  }
  if (stats.version) {
    lines.push(`I'm wearing version ${stats.version}`);
  }
  if (stats.branch) {
    lines.push(`I'm climbing the ${stats.branch} branch`);
    if (stats.branch === "main" || stats.branch === "master") {
      lines.push(`I'm nervous, you're on ${stats.branch}!`, "Push carefully, I'm watching");
    } else if (/fix|bug/i.test(stats.branch)) {
      lines.push("I smell a bug on this branch. Yum.");
    } else if (/feat/i.test(stats.branch)) {
      lines.push("I'm excited about the new feature");
    }
  }
  if (stats.edits >= 100) {
    lines.push("My tiny claws hurt from all the typing");
  } else if (stats.edits >= 50) {
    lines.push("I'm drowning in diffs");
  } else if (stats.edits >= 10) {
    lines.push("I'm getting the hang of this editing thing");
  } else if (stats.edits === 0) {
    lines.push("I haven't changed a thing. Yet.");
  }
  if (stats.commands >= 100) {
    lines.push("I live in the terminal now");
  } else if (stats.commands >= 20) {
    lines.push("I'm pressing a lot of big buttons");
  }
  if (stats.reads > stats.edits * 2 && stats.reads >= 10) {
    lines.push("I read way more than I write. Bookworm.");
  }
  if (stats.prompts >= 50) {
    lines.push("I'm stuffed, no more prompts. Okay, one more.");
  } else if (stats.prompts >= 10) {
    lines.push("I like how often you visit");
  } else if (stats.prompts <= 1) {
    lines.push("I just met you. Hi!");
  }
  const thousands = Math.round(stats.contextTokens / 1000);
  if (thousands > 0) {
    lines.push(`My tummy holds ${thousands}k tokens`);
  }
  if (thousands >= 400) {
    lines.push("I can't remember anything anymore. Who are you?");
  } else if (thousands >= 200) {
    lines.push("I'm so full I can barely waddle");
  } else if (thousands >= 100) {
    lines.push("I need to loosen my belt");
  } else if (thousands > 0 && thousands < 20) {
    lines.push("My tummy is nice and empty");
  }
  const step = currentStep(stats);
  if (step) {
    lines.push(`I'm on step ${step.number} of ${step.total}`);
    if (step.number === step.total) {
      lines.push("I can see the finish line!");
    } else if (step.number === 1) {
      lines.push(`I just started, ${step.total - 1} more steps to go`);
    }
  }
  if (others === 0) {
    lines.push("I have you all to myself");
  } else if (others >= 3) {
    lines.push(`I have to share you with ${others} other sessions`, "I'm jealous of the other sessions");
  } else {
    lines.push(`I'm waving at ${others} other session${others === 1 ? "" : "s"}`);
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
    lines.push(`I drew a map of ${folder}. It's mostly snacks.`, `I filed a bug against ${folder}. The bug is cute.`, `I think ${folder} looks tasty`);
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
    { type: 0, line: "I think this is a video game 🎮" },
    { type: 2, line: "I'm listening to the fans spin up 🎧" },
    { type: 3, line: "I'm watching Claude work, with popcorn 🍿" },
  ],
  content: [
    { type: 0, line: "I want to play. Tag, you're it! 🎮" },
    { type: 2, line: "I put on some lofi beats to wait to 🎶" },
    { type: 3, line: "I'm watching the cursor blink 👀" },
  ],
  hungry: [
    { type: 0, line: "I'm playing with my food 🍕" },
    { type: 2, line: "I'm listening to my tummy rumble 🎵" },
    { type: 3, line: "Clawd is watching the fridge, just in case 👀" },
  ],
  asleep: [
    { type: 0, line: "I'm playing in my dreams 💤" },
    { type: 2, line: "I fell asleep to the sound of rain 🌙" },
    { type: 3, line: "Clawd is watching its dreams 😴" },
  ],
};

const actionWishes: [RegExp, Wish][] = [
  [/^Editing/, { type: 0, line: "I'm playing with the code like it's clay 🎨" }],
  [/^Reading/, { type: 2, line: "I'm being read a bedtime story 📖" }],
  [/^Running a command/, { type: 3, line: "I'm watching the terminal go brrr 🍿" }],
  [/^Searching/, { type: 0, line: "I'm playing hide and seek with the code 🙈" }],
  [/^Browsing/, { type: 3, line: "I'm watching cat videos. It's research. 🐈" }],
  [/^Running a subagent/, { type: 3, line: "Clawd is watching a tiny Clawd do the work 👀" }],
  [/^Thinking/, { type: 2, line: "I'm listening to Claude think 🎧" }],
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
  if (mood === "busy") {
    const message = messages[Math.floor(Math.random() * messages.length)].toLowerCase();
    return `${Math.random() < NAME_CHANCE ? "Clawd is" : "I'm"} ${message}`;
  }
  const pool = lines[mood];
  return pool[Math.floor(Math.random() * pool.length)];
}
