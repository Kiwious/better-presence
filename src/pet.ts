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
    "I'm sunbathing under your monitor",
    "I'm practicing my sideways walk",
    "All done! Do I get a treat?",
    "Clawd is admiring the finished work",
  ],
  hungry: [
    "I'm hungry, feed me a prompt!",
    "My tummy is rumbling in Morse code",
    "Clawd is staring at you. Unblinkingly.",
    "I miss you (and your prompts)",
    "I'm nibbling on the scrollbar",
    "Did you forget about me?",
    "Clawd would do anything for one small prompt",
  ],
  asleep: [
    "Clawd is asleep. Zzz…",
    "I'm dreaming of infinite tokens",
    "Shh, I'm napping on your keyboard",
    "I'm dreaming of a sea without bugs",
    "Clawd is curled up in the status bar",
    "Do not wake me, I'm compiling a dream",
  ],
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
  busy: (project) => [
    `I'm helping with ${project} (mostly cheering)`,
    `I'm sniffing around ${project}`,
    `Clawd is making ${project} better. Probably.`,
    `I'm carrying ${project} on my tiny back`,
  ],
  content: (project) => [
    `I'm guarding ${project} with tiny claws`,
    `I hid a snack in ${project}`,
    `I'm proud of ${project} today`,
  ],
  hungry: (project) => [
    `I want to get back to ${project}`,
    `Clawd is looking for crumbs in ${project}`,
    `${project} needs us. And I need a snack.`,
  ],
  asleep: (project) => [
    `Clawd is dreaming of ${project}`,
    `I fell asleep on ${project}. Do not disturb.`,
    `I'm snoring somewhere in ${project}`,
  ],
};

const fileLines: [RegExp, string[]][] = [
  [/\.md$/i, ["I'm a serious novelist now", "Clawd is working on chapter two", "I'm adding a heading to the heading"]],
  [/\.json$/i, ["I'm counting curly braces. Lost count. Again.", "One missing comma and I'm doomed"]],
  [/test/i, ["I'm hiding my eyes until the tests pass", "I'm testing the test that tests the tests"]],
  [/\.java$/i, ["Clawd ordered more coffee", "I'm building an AbstractSnackFactoryBean"]],
  [/\.tsx?$/i, ["I'm arguing with the types and losing", "I told the compiler it's any. It cried.", "Clawd is undefined and proud"]],
  [/\.jsx?$/i, ["I'm adding 1 and '1'. Fun!", "Clawd doesn't need types, Clawd has courage"]],
  [/\.py$/i, ["I'm nervously checking my indentation", "I'm wrestling a very small snake"]],
  [/\.(cpp|c|h|hpp)$/i, ["I'm afraid of pointers, they point at me", "Clawd dereferenced a snack. Segfault."]],
  [/\.(css|scss)$/i, ["I've been centering this div since Tuesday", "I made it 1px to the left. Better."]],
  [/\.html?$/i, ["I'm closing every tag I open. Mostly.", "Clawd is nesting divs like a tiny bird"]],
  [/\.rs$/i, ["The borrow checker took my snack", "I'm borrowing this claw, not moving it"]],
  [/\.go$/i, ["if err != nil, I cry", "Clawd is handling the error. Again."]],
  [/\.(sh|ps1|bat|cmd|vbs)$/i, ["I'm writing a spell for the terminal", "Clawd hopes nobody runs this as admin"]],
  [/\.ya?ml$/i, ["One wrong space and it all falls down", "Clawd is counting spaces in the config"]],
  [/\.sql$/i, ["DROP TABLE snacks? Never.", "I forgot the WHERE. Kidding. Probably."]],
  [/\.lock$|lock\.json$/i, ["Nobody reads lock files. Except me.", "I'm admiring 9000 lines of nothing"]],
  [/\.(png|jpe?g|gif|svg|ico)$/i, ["I'm posing for this picture", "Clawd is an art critic now"]],
];

// What Clawd says to what's happening right now, a new action needs an entry
const reactions: Record<string, string[]> = {
  "Running a command": [
    "I pressed the big button. Oops?",
    "I'm watching the terminal go brrr",
    "I have my claws crossed for this command",
    "I'm reading the output like tea leaves",
    "Clawd is blowing on the terminal for luck",
    "I asked the shell nicely",
  ],
  "Running the tests": [
    "Green, please be green",
    "Clawd has every claw crossed",
    "I bribed the tests with snacks",
    "I can't watch. I'm watching.",
    "I'm rooting for every single test",
  ],
  Building: [
    "I'm stacking bricks very carefully",
    "Clawd is wearing a tiny hard hat",
    "I'm watching the progress bar like a movie",
    "It compiles on my claw",
    "I'm feeding the compiler. It's picky.",
  ],
  Linting: [
    "I got told off for a missing comma",
    "Clawd is ironing the code",
    "I'm picking lint out of my shell",
    "I sorted the imports by smell",
  ],
  "Installing packages": [
    "node_modules just ate my house",
    "Clawd is unpacking boxes",
    "I'm carrying packages, one claw at a time",
    "I hope nobody ordered another left-pad",
  ],
  Committing: [
    "I'm signing it with a tiny claw print",
    "Clawd wrote a very serious commit message",
    "It's official now. No take-backs.",
    "I'm saving my progress before the boss fight",
  ],
  Pushing: [
    "Off it goes! Bye, little commits",
    "Clawd is waving at the remote",
    "I'm pushing with both claws",
    "Into the cloud with you",
  ],
  "Syncing with git": [
    "I'm hoping for no merge conflicts",
    "Clawd is untangling the branches",
    "I brought the latest snacks from the remote",
  ],
  "Checking git": [
    "I'm reading the diary of this repo",
    "I'm checking who wrote this. Oh. It was us.",
    "Clawd is snooping through the history",
    "I asked git what happened. It sighed.",
  ],
  "Talking to GitHub": [
    "I'm waving at the octocat",
    "Clawd is sending the octocat a letter",
    "I'm checking if CI likes me yet",
  ],
  "Deleting files": [
    "Snip snip, gone",
    "I'm holding a tiny funeral",
    "Clawd didn't see anything",
    "Goodbye, little file. I barely knew you.",
  ],
  "Running containers": [
    "I'm stacking containers like a tiny dock worker",
    "Clawd is living in a box, by choice",
    "I'm riding the whale",
  ],
  "Searching the code": [
    "I'm digging through the code like a beach",
    "I lost my snack somewhere in the code",
    "I'm sniffing for clues, detective hat on",
    "Clawd found something. It was lint.",
    "I know it's in here somewhere",
    "I'm turning over every rock in this repo",
  ],
  "Browsing the web": [
    "I'm surfing the web on a tiny board",
    "I opened 40 tabs. Send help.",
    "I only went in for one page",
    "Clawd fell down a rabbit hole",
    "I'm reading the comments. Bad idea.",
  ],
  "Running a subagent": [
    "I called a friend for help",
    "Clawd is bossing around a tiny Clawd",
    "I hired an intern. It's also me.",
    "I'm supervising from a small chair",
    "I delegated. Very senior of me.",
  ],
  Thinking: [
    "I'm thinking very, very hard",
    "Smoke is coming out of my ears",
    "Hold on, I almost had it",
    "Clawd is staring into the middle distance",
    "I'm loading a big thought",
    "My one brain cell is on overtime",
  ],
  Working: [
    "I'm doing something. Don't ask what.",
    "Clawd is very busy and important",
    "My claws are full",
    "I'm pulling levers, some of them real",
  ],
  "Asking you something": [
    "I have a question! Claw raised.",
    "Clawd is waiting for your answer, patiently",
    "Your turn! I'm all ears. I have no ears.",
    "I can't decide, you pick",
  ],
  Planning: [
    "I'm drawing a plan on a napkin",
    "Clawd made a big map with an X on it",
    "I have a plan. It has snacks in it.",
    "Step one: don't panic",
  ],
  "Using a skill": [
    "I'm showing off my new trick",
    "Clawd read the manual for once",
    "I learned this one yesterday",
  ],
  "Working on a page": [
    "I'm making something pretty",
    "Clawd is hanging it on the fridge",
    "I'm choosing a font for way too long",
  ],
  "Looking for a tool": [
    "I'm rummaging through the toolbox",
    "Clawd lost the tiny hammer",
    "I know I put that wrench somewhere",
  ],
  "Using a connector": [
    "I'm making a phone call",
    "Clawd is plugging in another cable",
    "I know a guy. He has an API.",
  ],
  "Setting a timer": [
    "I set a tiny alarm",
    "Clawd is watching the clock",
    "Wake me when it's done",
  ],
  "Managing sessions": [
    "I'm tidying the sidebar",
    "Clawd is herding sessions",
    "I'm passing a note to another me",
  ],
};

function actionLines(action: string) {
  const file = action.match(/^(?:Editing|Reading) (.+)$/)?.[1];
  const fileTypeLines = fileLines.filter(([type]) => file && type.test(file)).flatMap(([, lines]) => lines);
  if (action.startsWith("Editing")) {
    return [
      `I'm holding the pen for ${file}`,
      `I'm proofreading ${file} very seriously`,
      `Clawd drew a little heart in ${file}`,
      `I'm fixing ${file}. Or breaking it. We'll see.`,
      `I left a tiny claw mark on ${file}`,
      ...fileTypeLines,
    ];
  }
  if (action.startsWith("Reading")) {
    return [
      `I'm reading ${file} upside down`,
      `I took notes on ${file}. They're all drawings.`,
      `Clawd is sniffing ${file}`,
      `I'm reading ${file} out loud to myself`,
      `Who wrote ${file}? I have questions.`,
      ...fileTypeLines,
    ];
  }
  return reactions[action] ?? [];
}

function failureLines(stats: SessionStats) {
  const lines = [
    "That didn't work. I saw nothing.",
    "Oops. I blame the semicolon.",
    "Clawd is pretending that didn't happen",
    "Ouch, red text. I'm offering a hug.",
    "I'm sure that was supposed to happen",
  ];
  switch (stats.failedAction) {
    case "Running the tests":
      lines.push("Red! I said green!", "A test failed. I'm looking at the floor.", "Clawd is blaming the test, not the code");
      break;
    case "Building":
      lines.push("The bricks fell over", "The compiler spat out my snack");
      break;
    case "Committing":
      lines.push("The commit said no", "The hook bit me");
      break;
    case "Pushing":
      lines.push("The remote doesn't want our commits", "Clawd got pushed back");
      break;
    case "Installing packages":
      lines.push("The package got lost in the mail");
      break;
  }
  if (stats.failures >= 3) {
    lines.push(`That's ${stats.failures} fails in a row. I brought tissues.`, "Clawd suggests turning it off and on again");
  }
  return lines;
}

const interruptedLines = [
  "You stopped me! I was doing so well.",
  "Clawd will just sit here then",
  "I stopped. Mid-snip.",
  "Okay, okay, claws off the keyboard",
];

const streakLines: Record<string, (count: number) => string[]> = {
  edit: (count) => [`That's ${count} edits in a row. My claws are smoking.`, "Clawd hasn't stopped writing for a while"],
  read: (count) => [`I've read ${count} files in a row. No spoilers.`, "Clawd is doing a lot of homework"],
  command: (count) => [`${count} commands in a row. Big button day.`, "Clawd has moved into the terminal"],
  search: (count) => [`${count} searches in a row. Where did it go?`, "Clawd is still looking. It's fine."],
};

function timeLines(now: Date) {
  const hour = now.getHours();
  const day = now.getDay();
  const lines: string[] = [];
  if (hour < 5) {
    lines.push("Clawd says it's past bedtime", "I yawned so hard I fell over", "Nothing good happens at this hour. Keep going.");
  } else if (hour < 9) {
    lines.push("I'm up early and already suspicious", "I want breakfast. Bytes, ideally.");
  } else if (hour < 12) {
    lines.push("I'm at my best right now, enjoy it", "I had a second coffee. I'm vibrating.");
  } else if (hour < 14) {
    lines.push("I want lunch. It's always lunch.", "Clawd is eating at the desk again");
  } else if (hour < 17) {
    lines.push("I have the afternoon sleepies", "Clawd could really go for a nap");
  } else if (hour < 20) {
    lines.push("I smell dinner. Is that yours? It's mine now.", "Clawd thinks it's almost time to log off. Almost.");
  } else {
    lines.push("I put on my tiny night shift hat", "I'm burning the midnight oil");
  }
  if (day === 0 || day === 6) {
    lines.push("Clawd works weekends too", "I asked for a day off. Denied by me.");
  } else if (day === 1) {
    lines.push("I have a case of the Mondays");
  } else if (day === 5) {
    lines.push("I'm already wearing my weekend socks", "No deploys on Friday, I'm watching");
  }
  const date = `${now.getMonth() + 1}-${now.getDate()}`;
  if (date === "12-24" || date === "12-25" || date === "12-26") {
    lines.push("I hung a tiny stocking on the terminal", "Clawd is hoping for a bigger context window");
  } else if (date === "10-31") {
    lines.push("I'm dressed as a bug. Boo!");
  } else if (date === "1-1") {
    lines.push("New year, same bugs");
  } else if (date === "4-1") {
    lines.push("I deleted everything. April fools! Probably.");
  }
  return lines;
}

function sessionLines(minutes: number) {
  if (minutes < 5) {
    return ["I just woke up, ready to cause problems", "I'm stretching my little claws"];
  }
  if (minutes >= 240) {
    return ["Go touch grass, I'll wait", "I have seen things in this session", "Clawd has grown a tiny beard"];
  }
  if (minutes >= 120) {
    return ["You should drink some water", "I'm impressed. And a little worried."];
  }
  return minutes >= 60 ? ["I demand a snack break", "Time flies when you're snipping"] : [];
}

const waitingLines: Record<Exclude<Mood, "busy">, string[]> = {
  content: [
    "I'm chasing my own shadow. Winning.",
    "I'm tidying your tabs. You're welcome.",
    "Your move, I'm ready",
    "Clawd is reviewing the work. Looks great.",
    "Did you see what we did? Did you?",
  ],
  hungry: [
    "I ate a stray semicolon. Crunchy.",
    "Clawd ate your last TODO. Problem solved.",
    "I'm chewing on an old bracket",
    "I've started eating the comments",
  ],
  asleep: [
    "Clawd is snoring in binary",
    "I'm counting sheep in hex",
    "I'm sleepwalking through your repo",
    "Zzz… no, I wasn't asleep",
  ],
};

// What the session's numbers make Clawd say; `others` is the number of other open app sessions
export function statsLines(stats: SessionStats, others: number) {
  const lines: string[] = [];
  if (stats.edits > 1) {
    lines.push(`Clawd counted ${stats.edits} edits so far`);
  }
  if (stats.commands > 1) {
    lines.push(`I counted ${stats.commands} commands so far`);
  }
  if (stats.prompts > 1) {
    lines.push(`I've been fed ${stats.prompts} prompts`);
  }
  if (stats.reads > 3) {
    lines.push(`I read ${stats.reads} files and understood 3`);
  }
  if (stats.searches > 1) {
    lines.push(`I sniffed around ${stats.searches} times`);
  }
  if (stats.commits > 0) {
    lines.push(stats.commits === 1 ? "I watched a commit happen. Beautiful." : `I watched ${stats.commits} commits. Beautiful.`);
  }
  if (stats.compactions > 0) {
    lines.push("I forgot most of this chat. Still cute, though.", "Clawd's memory got folded up to fit");
  }
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
    lines.push("My tiny claws hurt from all the typing", "Clawd needs a claw massage");
  } else if (stats.edits >= 50) {
    lines.push("I'm drowning in diffs", "So many changes, I can't keep up");
  } else if (stats.edits >= 10) {
    lines.push("I'm getting the hang of this editing thing");
  } else if (stats.edits === 0) {
    lines.push("I haven't changed a thing. Yet.");
  }
  if (stats.commands >= 100) {
    lines.push("I live in the terminal now", "Clawd gets mail at the terminal now");
  } else if (stats.commands >= 20) {
    lines.push("I'm pressing a lot of big buttons", "The big button and I are friends now");
  }
  if (stats.reads > stats.edits * 2 && stats.reads >= 10) {
    lines.push("I read way more than I write. Bookworm.");
  }
  if (stats.prompts >= 50) {
    lines.push("I'm stuffed, no more prompts. Okay, one more.");
  } else if (stats.prompts >= 10) {
    lines.push("I like how often you visit", "We're really talking today");
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
    lines.push("I'm so full I can barely waddle", "Clawd shouldn't have had that last token");
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
    } else {
      lines.push(`I ticked off ${step.number - 1} of ${step.total} boxes`);
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

// What Clawd reacts to first: what's going on this very moment
export function momentLines(mood: Mood, action?: string, stats?: SessionStats) {
  if (stats?.interrupted && mood !== "asleep") {
    return interruptedLines;
  }
  if (stats?.failures && mood !== "asleep") {
    return failureLines(stats);
  }
  if (mood !== "busy") {
    return mood !== "asleep" && stats?.action === "Asking you something" ? reactions[stats.action] : waitingLines[mood];
  }
  const streak = stats?.streakTool && stats.streak >= 5 ? streakLines[stats.streakTool](stats.streak) : [];
  return [...actionLines(action ?? ""), ...streak];
}

// What else fits right now; a sleeping Clawd doesn't care about the time
export function situationLines(mood: Mood, minutes: number, now: Date, folder?: string) {
  const lines = mood === "asleep" ? [] : [...timeLines(now), ...sessionLines(minutes)];
  if (folder) {
    lines.push(`I drew a map of ${folder}. It's mostly snacks.`, `I filed a bug against ${folder}. The bug is cute.`, `I think ${folder} looks tasty`);
  }
  return lines;
}

const said = new Set<string>();

// Every line that fits gets its turn before any of them repeats.
// Numbers don't make a line new, or it would keep winning and the others would never come back.
function pick(pool: string[]) {
  const key = (line: string) => line.replace(/\d+/g, "#");
  let fresh = pool.filter((line) => !said.has(key(line)));
  if (fresh.length === 0) {
    pool.forEach((line) => said.delete(key(line)));
    fresh = pool;
  }
  // The companion runs for weeks and file names keep making new lines
  if (said.size > 5000) {
    said.clear();
  }
  const line = fresh[Math.floor(Math.random() * fresh.length)];
  said.add(key(line));
  return line;
}

// Something random for the card: half the lines react to the moment, a quarter to the situation
export function petChatter(mood: Mood, sessionMs: number, folder?: string, task?: string, action?: string, stats?: SessionStats, others = 0) {
  const minutes = Math.floor(sessionMs / MINUTE);
  const time =
    minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
  const general = [
    ...(mood === "busy" ? [petLine(mood)] : lines[mood]),
    moodIcons[mood],
    `Clawd has been around for ${time}`,
  ];
  if (folder) {
    general.push(`Clawd lives in ${folder}`, ...projectLines[mood](folder));
  }
  if (task) {
    general.push(`Clawd is rooting for: ${task}`);
  }
  const moment = momentLines(mood, action, stats);
  const situation = [...situationLines(mood, minutes, new Date(), folder), ...(stats ? statsLines(stats, others) : [])];
  const roll = Math.random();
  const line = pick(roll < 0.5 && moment.length > 0 ? moment : roll < 0.75 && situation.length > 0 ? situation : general);
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

const actionWishes: [RegExp, Wish[]][] = [
  [/^Editing/, [
    { type: 0, line: "I'm playing with the code like it's clay 🎨" },
    { type: 2, line: "I'm listening to the keys go clack 🎹" },
  ]],
  [/^Reading/, [
    { type: 2, line: "I'm being read a bedtime story 📖" },
    { type: 3, line: "I'm watching the words go by 👀" },
  ]],
  [/^Running a command/, [
    { type: 3, line: "I'm watching the terminal go brrr 🍿" },
    { type: 0, line: "I'm playing whack-a-command 🔨" },
  ]],
  [/^Running the tests/, [
    { type: 3, line: "I'm watching the tests like a penalty shootout ⚽" },
    { type: 0, line: "I'm playing red light, green light 🚦" },
  ]],
  [/^Building/, [
    { type: 0, line: "I'm playing with building blocks 🧱" },
    { type: 3, line: "I'm watching paint dry, but it's a build 🎨" },
  ]],
  [/^(Committing|Pushing)/, [
    { type: 3, line: "Clawd is watching the commits sail away 🚢" },
    { type: 2, line: "I'm listening for the CI bell 🔔" },
  ]],
  [/^(Checking|Syncing with) git/, [{ type: 3, line: "I'm watching the repo's home videos 📼" }]],
  [/^Installing/, [{ type: 3, line: "I'm watching the delivery van 🚚" }]],
  [/^Searching/, [
    { type: 0, line: "I'm playing hide and seek with the code 🙈" },
    { type: 3, line: "I'm watching for clues 🔍" },
  ]],
  [/^Browsing/, [
    { type: 3, line: "I'm watching cat videos. It's research. 🐈" },
    { type: 2, line: "I'm listening to a podcast about the docs 🎧" },
  ]],
  [/^Running a subagent/, [
    { type: 3, line: "Clawd is watching a tiny Clawd do the work 👀" },
    { type: 0, line: "I'm playing boss 👑" },
  ]],
  [/^Thinking/, [
    { type: 2, line: "I'm listening to Claude think 🎧" },
    { type: 3, line: "I'm watching the gears turn 🧠" },
  ]],
  [/^Planning/, [{ type: 0, line: "I'm playing chess, four moves ahead 🧩" }]],
  [/^Asking/, [{ type: 2, line: "I'm listening for your answer 👂" }]],
];

export function petWish(mood: Mood, action?: string) {
  const moment = mood === "busy" && action ? actionWishes.filter(([match]) => match.test(action)).flatMap(([, wishes]) => wishes) : [];
  // The moment decides as often as the mood does
  const pool = moment.length > 0 && Math.random() < 0.5 ? moment : moodWishes[mood];
  const line = pick(pool.map((wish) => wish.line));
  return pool.find((wish) => wish.line === line)!;
}

export function petLine(mood: Mood) {
  if (mood === "busy") {
    const message = messages[Math.floor(Math.random() * messages.length)].toLowerCase();
    return `${Math.random() < NAME_CHANCE ? "Clawd is" : "I'm"} ${message}`;
  }
  const pool = lines[mood];
  return pool[Math.floor(Math.random() * pool.length)];
}
