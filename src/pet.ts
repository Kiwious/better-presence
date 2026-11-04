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
    "I'm polishing my shell for no reason",
    "I'm blowing tiny bubbles",
    "Clawd is doing laps around the taskbar",
    "That went well. I'm taking all the credit.",
    "I'm humming the build success song",
  ],
  hungry: [
    "I'm hungry, feed me a prompt!",
    "My tummy is rumbling in Morse code",
    "Clawd is staring at you. Unblinkingly.",
    "I miss you (and your prompts)",
    "I'm nibbling on the scrollbar",
    "Did you forget about me?",
    "Clawd would do anything for one small prompt",
    "I can smell a prompt from here",
    "I'd trade a claw for some context",
    "Clawd is writing a sad poem about snacks",
    "I licked the screen. No prompts there either.",
    "I'm getting hangry over here",
  ],
  asleep: [
    "Clawd is asleep. Zzz…",
    "I'm dreaming of infinite tokens",
    "Shh, I'm napping on your keyboard",
    "I'm dreaming of a sea without bugs",
    "Clawd is curled up in the status bar",
    "Do not wake me, I'm compiling a dream",
    "I'm snoozing in the recycle bin",
    "Clawd dreamed the tests passed",
    "I'm hibernating. Come back in spring.",
    "Zzz… merge conflict… zzz",
    "I'm drooling on the space bar",
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
    `I'm rearranging ${project} while nobody looks`,
    `Clawd is giving ${project} a good scrub`,
    `${project} and I are in the zone`,
  ],
  content: (project) => [
    `I'm guarding ${project} with tiny claws`,
    `I hid a snack in ${project}`,
    `I'm proud of ${project} today`,
    `I'm taking a victory lap around ${project}`,
    `Clawd approves of ${project}`,
    `${project} looks good from down here`,
  ],
  hungry: (project) => [
    `I want to get back to ${project}`,
    `Clawd is looking for crumbs in ${project}`,
    `${project} needs us. And I need a snack.`,
    `I checked ${project} for leftovers. Nothing.`,
    `Clawd would eat ${project} if it had sauce`,
    `Remember ${project}? I do.`,
  ],
  asleep: (project) => [
    `Clawd is dreaming of ${project}`,
    `I fell asleep on ${project}. Do not disturb.`,
    `I'm snoring somewhere in ${project}`,
    `I'm using ${project} as a pillow`,
    `Clawd tucked ${project} in for the night`,
    `${project} can wait until I wake up`,
  ],
};

const fileLines: [RegExp, string[]][] = [
  [/\.md$/i, ["I'm a serious novelist now", "Clawd is working on chapter two", "I'm adding a heading to the heading", "Clawd demands a table of contents", "I'm bolding things for emphasis"]],
  [/\.json$/i, ["I'm counting curly braces. Lost count. Again.", "One missing comma and I'm doomed", "No trailing commas, I promise", "Clawd misses having comments"]],
  [/test/i, ["I'm hiding my eyes until the tests pass", "I'm testing the test that tests the tests", "Clawd asserts that snacks are true", "I'm mocking everything. Even you."]],
  [/\.java$/i, ["Clawd ordered more coffee", "I'm building an AbstractSnackFactoryBean", "I wrote 40 lines to say hello", "Clawd has a getter for every claw"]],
  [/\.tsx?$/i, ["I'm arguing with the types and losing", "I told the compiler it's any. It cried.", "Clawd is undefined and proud", "I cast it as unknown and walked away", "Clawd is narrowing the type very slowly"]],
  [/\.jsx?$/i, ["I'm adding 1 and '1'. Fun!", "Clawd doesn't need types, Clawd has courage", "It worked, and nobody knows why", "I typed === with confidence"]],
  [/\.py$/i, ["I'm nervously checking my indentation", "I'm wrestling a very small snake", "Clawd counted four spaces. Again.", "I imported antigravity for morale"]],
  [/\.(cpp|c|h|hpp)$/i, ["I'm afraid of pointers, they point at me", "Clawd dereferenced a snack. Segfault.", "I forgot to free my snack", "Clawd is managing memory, badly"]],
  [/\.(css|scss)$/i, ["I've been centering this div since Tuesday", "I made it 1px to the left. Better.", "I added !important. Don't tell anyone.", "Clawd thinks it needs more gradient"]],
  [/\.html?$/i, ["I'm closing every tag I open. Mostly.", "Clawd is nesting divs like a tiny bird", "I'm wrapping that in one more div", "Clawd wants a marquee tag back"]],
  [/\.rs$/i, ["The borrow checker took my snack", "I'm borrowing this claw, not moving it", "Clawd is fighting the lifetimes", "It compiled, so I must be right"]],
  [/\.go$/i, ["if err != nil, I cry", "Clawd is handling the error. Again.", "I fixed it by running gofmt", "Clawd launched a goroutine to get snacks"]],
  [/\.(sh|ps1|bat|cmd|vbs)$/i, ["I'm writing a spell for the terminal", "Clawd hopes nobody runs this as admin", "I'm quoting every variable, just in case", "Clawd read the script before running it. Mostly."]],
  [/\.ya?ml$/i, ["One wrong space and it all falls down", "Clawd is counting spaces in the config", "Is that a string or a boolean? Who knows.", "I'm indenting with my whole body"]],
  [/\.sql$/i, ["DROP TABLE snacks? Never.", "I forgot the WHERE. Kidding. Probably.", "I joined six tables for one snack", "Clawd is selecting star, sorry"]],
  [/\.lock$|lock\.json$/i, ["Nobody reads lock files. Except me.", "I'm admiring 9000 lines of nothing", "Clawd is pretending to review this", "This file is longer than my life"]],
  [/\.(png|jpe?g|gif|svg|ico)$/i, ["I'm posing for this picture", "Clawd is an art critic now", "I look great in this one", "Clawd would center that a bit more"]],
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
    "I hope that wasn't the wrong folder",
    "Clawd is waiting for the exit code",
    "I'm guarding the terminal from bugs",
    "Beep boop, I speak fluent shell",
    "I typed nothing and it still ran",
  ],
  "Running the tests": [
    "Green, please be green",
    "Clawd has every claw crossed",
    "I bribed the tests with snacks",
    "I can't watch. I'm watching.",
    "I'm rooting for every single test",
    "I'm reading the dots like tea leaves",
    "Clawd wrote a good luck note to each test",
    "Please don't be flaky, please don't be flaky",
    "It passed on my claw",
    "I'm hugging the test runner",
  ],
  Building: [
    "I'm stacking bricks very carefully",
    "Clawd is wearing a tiny hard hat",
    "I'm watching the progress bar like a movie",
    "It compiles on my claw",
    "I'm feeding the compiler. It's picky.",
    "Clawd is sweeping up the sawdust",
    "I'm hitting it with a tiny hammer",
    "Almost done. That's what I always say.",
    "I put the bundle on a diet",
    "I'm supervising the bricks",
  ],
  Linting: [
    "I got told off for a missing comma",
    "Clawd is ironing the code",
    "I'm picking lint out of my shell",
    "I sorted the imports by smell",
    "Clawd lost an argument with a semicolon",
    "I'm combing the code's hair",
    "The linter says I have opinions",
    "I fixed the spaces. So many spaces.",
    "I'm tidying up before guests arrive",
  ],
  "Installing packages": [
    "node_modules just ate my house",
    "Clawd is unpacking boxes",
    "I'm carrying packages, one claw at a time",
    "I hope nobody ordered another left-pad",
    "Clawd signed for 847 packages",
    "My hard drive just sighed",
    "I'm reading every license. Not really.",
    "One dependency brought all its friends",
    "I'm stacking boxes in the hallway",
  ],
  Committing: [
    "I'm signing it with a tiny claw print",
    "Clawd wrote a very serious commit message",
    "It's official now. No take-backs.",
    "I'm saving my progress before the boss fight",
    "Clawd is writing history, literally",
    "Dear diary, today we changed some code",
    "I'm taking a snapshot. Say cheese!",
    "That one's going in the scrapbook",
    "I'm pressing the save button of destiny",
  ],
  Pushing: [
    "Off it goes! Bye, little commits",
    "Clawd is waving at the remote",
    "I'm pushing with both claws",
    "Into the cloud with you",
    "I hope the remote is in a good mood",
    "Clawd is holding the door for the commits",
    "Go on, little branch, see the world",
    "I'm mailing our code to the internet",
    "Heave! Ho! There it goes.",
  ],
  "Syncing with git": [
    "I'm hoping for no merge conflicts",
    "Clawd is untangling the branches",
    "I brought the latest snacks from the remote",
    "Clawd is making everyone agree",
    "I'm stitching the timelines back together",
    "I'm catching up on the gossip",
    "Please, no conflicts today",
    "I fetched. Good boy, me.",
  ],
  "Checking git": [
    "I'm reading the diary of this repo",
    "I'm checking who wrote this. Oh. It was us.",
    "Clawd is snooping through the history",
    "I asked git what happened. It sighed.",
    "I'm looking at what we changed. Yikes.",
    "Clawd is counting the untracked files",
    "I'm reading the log like a mystery novel",
    "I'm comparing before and after photos",
    "git says we're on a branch. I'm in a tree.",
  ],
  "Talking to GitHub": [
    "I'm waving at the octocat",
    "Clawd is sending the octocat a letter",
    "I'm checking if CI likes me yet",
    "I'm reading the checks with one eye open",
    "Clawd left a tiny comment",
    "I'm tapping on GitHub's window",
    "I hope that check goes green",
    "Clawd is asking for a review, politely",
  ],
  "Deleting files": [
    "Snip snip, gone",
    "I'm holding a tiny funeral",
    "Clawd didn't see anything",
    "Goodbye, little file. I barely knew you.",
    "Clawd says it was time",
    "Less code, fewer bugs. I'm a genius.",
    "I'm emptying the snack wrappers",
    "I swear that file was like this",
    "Into the void, little bytes",
  ],
  "Running containers": [
    "I'm stacking containers like a tiny dock worker",
    "Clawd is living in a box, by choice",
    "I'm riding the whale",
    "Clawd is packing a very small suitcase",
    "It works in my container",
    "I'm putting boxes inside boxes",
    "I'm waving at the whale",
    "Clawd is pulling images all day",
  ],
  "Searching the code": [
    "I'm digging through the code like a beach",
    "I lost my snack somewhere in the code",
    "I'm sniffing for clues, detective hat on",
    "Clawd found something. It was lint.",
    "I know it's in here somewhere",
    "I'm turning over every rock in this repo",
    "Clawd checked under the couch too",
    "I'm following a trail of semicolons",
    "It's always in the last file",
    "I'm squinting at the search results",
    "I found it! No wait, that's a different one.",
  ],
  "Browsing the web": [
    "I'm surfing the web on a tiny board",
    "I opened 40 tabs. Send help.",
    "I only went in for one page",
    "Clawd fell down a rabbit hole",
    "I'm reading the comments. Bad idea.",
    "I'm checking if this is still true",
    "Clawd promises it's for work",
    "I found the docs. They're from 2014.",
    "I'm reading the fine print with a tiny lens",
    "I declined all the cookies. Ate them first.",
  ],
  "Running a subagent": [
    "I called a friend for help",
    "Clawd is bossing around a tiny Clawd",
    "I hired an intern. It's also me.",
    "I'm supervising from a small chair",
    "I delegated. Very senior of me.",
    "Clawd cloned itself. It's fine.",
    "My tiny coworker is doing great",
    "I'm taking credit for this later",
    "I sent a smaller me into the code",
    "I'm waiting for the report, feet up",
  ],
  Thinking: [
    "I'm thinking very, very hard",
    "Smoke is coming out of my ears",
    "Hold on, I almost had it",
    "Clawd is staring into the middle distance",
    "I'm loading a big thought",
    "My one brain cell is on overtime",
    "Clawd is carrying the one",
    "I'm thinking about thinking",
    "Wait. No. Wait. Yes.",
    "I'm consulting my inner crab",
    "I had an idea, it's loading",
    "Clawd can hear the gears from here",
  ],
  Working: [
    "I'm doing something. Don't ask what.",
    "Clawd is very busy and important",
    "My claws are full",
    "I'm pulling levers, some of them real",
    "Clawd is on it, whatever it is",
    "I'm being extremely productive, trust me",
    "I'm doing the thing with the stuff",
    "I'm busy. Very official.",
    "Clawd looks busy, and that's half the job",
  ],
  "Asking you something": [
    "I have a question! Claw raised.",
    "Clawd is waiting for your answer, patiently",
    "Your turn! I'm all ears. I have no ears.",
    "I can't decide, you pick",
    "I need a grown-up",
    "Clawd is holding up a tiny sign",
    "I'm tapping my claws, no pressure",
    "Pick one. I'll pretend I agree.",
    "I'm waiting right here. Staring.",
  ],
  Planning: [
    "I'm drawing a plan on a napkin",
    "Clawd made a big map with an X on it",
    "I have a plan. It has snacks in it.",
    "Step one: don't panic",
    "Clawd drew arrows. So many arrows.",
    "I'm making a list and checking it twice",
    "This plan has a backup plan",
    "I'm moving tiny figures around a map",
    "Measure twice, snip once",
  ],
  "Using a skill": [
    "I'm showing off my new trick",
    "Clawd read the manual for once",
    "I learned this one yesterday",
    "Clawd has been practicing this",
    "Watch this, I'm a professional",
    "I'm following the recipe exactly",
    "I have a certificate for this. Somewhere.",
  ],
  "Working on a page": [
    "I'm making something pretty",
    "Clawd is hanging it on the fridge",
    "I'm choosing a font for way too long",
    "I'm picking colors, this takes hours",
    "Clawd moved the button one more time",
    "I'm adding a tiny bit of sparkle",
    "It looks great on my very small screen",
  ],
  "Looking for a tool": [
    "I'm rummaging through the toolbox",
    "Clawd lost the tiny hammer",
    "I know I put that wrench somewhere",
    "Clawd is checking every drawer",
    "It's always in the last drawer",
    "I found a tool. Wrong one.",
    "I'm reading the labels on the toolbox",
  ],
  "Using a connector": [
    "I'm making a phone call",
    "Clawd is plugging in another cable",
    "I know a guy. He has an API.",
    "Clawd is asking another app nicely",
    "I'm passing notes between apps",
    "I have a friend on the outside",
    "Hold please, I'm on the other line",
  ],
  "Setting a timer": [
    "I set a tiny alarm",
    "Clawd is watching the clock",
    "Wake me when it's done",
    "I'm counting to a very big number",
    "Clawd will be back. Probably.",
    "I'm watching the pot, it won't boil",
    "I'll just wait here, it's fine",
  ],
  "Managing sessions": [
    "I'm tidying the sidebar",
    "Clawd is herding sessions",
    "I'm passing a note to another me",
    "Clawd is sorting the chats by vibe",
    "I'm putting the other Clawds to work",
    "I'm organizing my many selves",
    "I labeled everything. You're welcome.",
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
      `Clawd is rewriting ${file} from memory`,
      `I'm whispering sweet nothings to ${file}`,
      `${file} looks better already. Doesn't it?`,
      `I'm moving things around in ${file} with one claw`,
      `I hope ${file} isn't load-bearing`,
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
      `Clawd read ${file} and needs a moment`,
      `I'm highlighting all of ${file}`,
      `${file} has a surprise ending`,
      `I'm skimming ${file}. Don't tell anyone.`,
      `I found a typo in ${file}, I think`,
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
    "I'm sure that was supposed to happen", "Clawd will just try that again", "I meant to do that", "It worked on my claw", "Have you tried asking nicely?", "Red text builds character", "Clawd is reading the error very slowly",
  ];
  switch (stats.failedAction) {
    case "Running the tests":
      lines.push("Red! I said green!", "A test failed. I'm looking at the floor.", "Clawd is blaming the test, not the code", "I'm rewriting the test. Kidding.", "That test had it coming");
      break;
    case "Building":
      lines.push("The bricks fell over", "The compiler spat out my snack", "Clawd is reading a very long error", "The build fell down the stairs");
      break;
    case "Committing":
      lines.push("The commit said no", "The hook bit me", "Clawd was told to try again");
      break;
    case "Pushing":
      lines.push("The remote doesn't want our commits", "Clawd got pushed back", "Rejected! How rude.");
      break;
    case "Installing packages":
      lines.push("The package got lost in the mail", "Clawd is on hold with the registry");
      break;
  }
  if (stats.failures >= 3) {
    lines.push(`That's ${stats.failures} fails in a row. I brought tissues.`, "Clawd suggests turning it off and on again", "I'm starting to take this personally", "Clawd has seen this error before. Today.");
  }
  return lines;
}

const interruptedLines = [
  "You stopped me! I was doing so well.",
  "Clawd will just sit here then",
  "I stopped. Mid-snip.",
  "Okay, okay, claws off the keyboard",
  "Fine, I'll put the pen down",
  "Clawd was almost done. Almost!",
  "I'm standing very still now",
  "Was it something I said?",
  "Okay, your way then",
];

const streakLines: Record<string, (count: number) => string[]> = {
  edit: (count) => [`That's ${count} edits in a row. My claws are smoking.`, "Clawd hasn't stopped writing for a while", "I'm on an editing spree, stand back"],
  read: (count) => [`I've read ${count} files in a row. No spoilers.`, "Clawd is doing a lot of homework", "I'm reading everything, including the fine print"],
  command: (count) => [`${count} commands in a row. Big button day.`, "Clawd has moved into the terminal", "My button finger is getting tired"],
  search: (count) => [`${count} searches in a row. Where did it go?`, "Clawd is still looking. It's fine.", "It has to be in here somewhere"],
};

function timeLines(now: Date) {
  const hour = now.getHours();
  const day = now.getDay();
  const lines: string[] = [];
  if (hour < 5) {
    lines.push("Clawd says it's past bedtime", "I yawned so hard I fell over", "Nothing good happens at this hour. Keep going.", "The bugs come out at night", "Clawd can see the moon from the taskbar");
  } else if (hour < 9) {
    lines.push("I'm up early and already suspicious", "I want breakfast. Bytes, ideally.", "Clawd hasn't had coffee yet, careful", "Who starts this early? We do.");
  } else if (hour < 12) {
    lines.push("I'm at my best right now, enjoy it", "I had a second coffee. I'm vibrating.", "Clawd has a good feeling about this morning");
  } else if (hour < 14) {
    lines.push("I want lunch. It's always lunch.", "Clawd is eating at the desk again", "I'm dropping crumbs in your keyboard");
  } else if (hour < 17) {
    lines.push("I have the afternoon sleepies", "Clawd could really go for a nap", "The afternoon is very long today");
  } else if (hour < 20) {
    lines.push("I smell dinner. Is that yours? It's mine now.", "Clawd thinks it's almost time to log off. Almost.", "One more thing and then we stop. Sure.");
  } else {
    lines.push("I put on my tiny night shift hat", "I'm burning the midnight oil", "Clawd likes it when it's quiet like this");
  }
  if (day === 0 || day === 6) {
    lines.push("Clawd works weekends too", "I asked for a day off. Denied by me.", "No meetings today. I love weekends.");
  } else if (day === 1) {
    lines.push("I have a case of the Mondays", "Clawd is pretending it's still Sunday");
  } else if (day === 5) {
    lines.push("I'm already wearing my weekend socks", "No deploys on Friday, I'm watching", "Clawd is mentally at the beach");
  }
  const date = `${now.getMonth() + 1}-${now.getDate()}`;
  if (date === "12-24" || date === "12-25" || date === "12-26") {
    lines.push("I hung a tiny stocking on the terminal", "Clawd is hoping for a bigger context window", "I left cookies out for the compiler");
  } else if (date === "10-31") {
    lines.push("I'm dressed as a bug. Boo!", "Clawd is trick-or-treating for tokens");
  } else if (date === "1-1") {
    lines.push("New year, same bugs", "My resolution: fewer bugs. Eating them counts.");
  } else if (date === "4-1") {
    lines.push("I deleted everything. April fools! Probably.", "Clawd replaced your semicolons. Just kidding.");
  }
  return lines;
}

function sessionLines(minutes: number) {
  if (minutes < 5) {
    return ["I just woke up, ready to cause problems", "I'm stretching my little claws", "Clawd brought a fresh notebook", "Let's see what we break today"];
  }
  if (minutes >= 240) {
    return ["Go touch grass, I'll wait", "I have seen things in this session", "Clawd has grown a tiny beard", "This session has its own weather now", "I can't remember life before this session"];
  }
  if (minutes >= 120) {
    return ["You should drink some water", "I'm impressed. And a little worried.", "Clawd suggests standing up for a second", "My claws need a stretch. Yours too."];
  }
  return minutes >= 60 ? ["I demand a snack break", "Time flies when you're snipping", "An hour already? Clawd didn't notice."] : [];
}

const waitingLines: Record<Exclude<Mood, "busy">, string[]> = {
  content: [
    "I'm chasing my own shadow. Winning.",
    "I'm tidying your tabs. You're welcome.",
    "Your move, I'm ready",
    "Clawd is reviewing the work. Looks great.",
    "Did you see what we did? Did you?",
    "I'm admiring what we built",
    "Clawd saved you a seat",
    "Waiting is my second favorite thing",
  ],
  hungry: [
    "I ate a stray semicolon. Crunchy.",
    "Clawd ate your last TODO. Problem solved.",
    "I'm chewing on an old bracket",
    "I've started eating the comments",
    "I found a crumb in the sidebar. Mine.",
    "Clawd is gnawing on the status bar",
    "I'm nibbling on your old commits",
  ],
  asleep: [
    "Clawd is snoring in binary",
    "I'm counting sheep in hex",
    "I'm sleepwalking through your repo",
    "Zzz… no, I wasn't asleep",
    "Clawd is dreaming in monospace",
    "I'm breathing in tabs and out in spaces",
    "I fell asleep mid-sn",
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
    lines.push("I forgot most of this chat. Still cute, though.", "Clawd's memory got folded up to fit", "What were we doing again?");
  }
  const model = modelName(stats.model);
  if (model) {
    lines.push(`Clawd runs on ${model} today`, `${model} is my big brain`);
  }
  if (stats.model?.includes("opus")) {
    lines.push("I'm writing a whole opus", "Clawd brought the big brain today");
  } else if (stats.model?.includes("sonnet")) {
    lines.push("I'm rhyming in 14 lines", "Clawd is reading sonnets to the code");
  } else if (stats.model?.includes("haiku")) {
    lines.push("I only speak in three short lines", "Clawd keeps it short today");
  }
  if (stats.version) {
    lines.push(`I'm wearing version ${stats.version}`);
  }
  if (stats.branch) {
    lines.push(`I'm climbing the ${stats.branch} branch`);
    if (stats.branch === "main" || stats.branch === "master") {
      lines.push(`I'm nervous, you're on ${stats.branch}!`, "Push carefully, I'm watching", "Clawd would use a branch. Just saying.");
    } else if (/fix|bug/i.test(stats.branch)) {
      lines.push("I smell a bug on this branch. Yum.", "Clawd came here to squash things");
    } else if (/feat/i.test(stats.branch)) {
      lines.push("I'm excited about the new feature", "Clawd wants to be the first to try it");
    }
  }
  if (stats.edits >= 100) {
    lines.push("My tiny claws hurt from all the typing", "Clawd needs a claw massage");
  } else if (stats.edits >= 50) {
    lines.push("I'm drowning in diffs", "So many changes, I can't keep up");
  } else if (stats.edits >= 10) {
    lines.push("I'm getting the hang of this editing thing", "We're really changing things now");
  } else if (stats.edits === 0) {
    lines.push("I haven't changed a thing. Yet.", "Clawd is still warming up");
  }
  if (stats.commands >= 100) {
    lines.push("I live in the terminal now", "Clawd gets mail at the terminal now");
  } else if (stats.commands >= 20) {
    lines.push("I'm pressing a lot of big buttons", "The big button and I are friends now");
  }
  if (stats.reads > stats.edits * 2 && stats.reads >= 10) {
    lines.push("I read way more than I write. Bookworm.", "Clawd is studying for the big edit");
  }
  if (stats.prompts >= 50) {
    lines.push("I'm stuffed, no more prompts. Okay, one more.", "Clawd has lost count of your prompts");
  } else if (stats.prompts >= 10) {
    lines.push("I like how often you visit", "We're really talking today", "I think we're friends now");
  } else if (stats.prompts <= 1) {
    lines.push("I just met you. Hi!", "Clawd likes you already");
  }
  const thousands = Math.round(stats.contextTokens / 1000);
  if (thousands > 0) {
    lines.push(`My tummy holds ${thousands}k tokens`);
  }
  if (thousands >= 400) {
    lines.push("I can't remember anything anymore. Who are you?", "Clawd's head is about to pop");
  } else if (thousands >= 200) {
    lines.push("I'm so full I can barely waddle", "Clawd shouldn't have had that last token", "I need a nap after all this context");
  } else if (thousands >= 100) {
    lines.push("I need to loosen my belt", "Clawd is getting a little round");
  } else if (thousands > 0 && thousands < 20) {
    lines.push("My tummy is nice and empty", "Plenty of room in here for more");
  }
  const step = currentStep(stats);
  if (step) {
    lines.push(`I'm on step ${step.number} of ${step.total}`);
    if (step.number === step.total) {
      lines.push("I can see the finish line!", "One more step and I'm done", "Clawd is warming up the victory dance");
    } else if (step.number === 1) {
      lines.push(`I just started, ${step.total - 1} more steps to go`);
    } else {
      lines.push(`I ticked off ${step.number - 1} of ${step.total} boxes`);
    }
  }
  if (others === 0) {
    lines.push("I have you all to myself", "Just you and me, partner");
  } else if (others >= 3) {
    lines.push(`I have to share you with ${others} other sessions`, "I'm jealous of the other sessions", "Clawd sees you've got other crabs");
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

const pettedLines: Record<Mood, string[]> = {
  busy: [
    "Someone petted me mid-snip!",
    "I got a pet at work. Best job ever.",
    "Clawd felt that! Back to work, happily.",
    "A stranger petted me and I typed a heart",
    "A pet! Hold on, I'm saving this file.",
    "Clawd is blushing at the terminal",
    "Someone's distracting me. Don't stop.",
  ],
  content: [
    "Someone petted me! Do it again!",
    "I'm wiggling all my claws, I got a pet!",
    "Clawd got a pet and is telling everyone",
    "Who was that? I liked that.",
    "That's the good spot, right there",
    "Clawd is purring. Crabs can purr now.",
    "I felt that in all my legs",
  ],
  hungry: [
    "A pet! Almost as good as a prompt.",
    "Someone petted me. Was there a snack too?",
    "Clawd felt a pet. Clawd is still hungry.",
    "Pets are nice, but do they come with snacks?",
    "Clawd will accept this as a down payment",
    "I nibbled the hand that petted me. Gently.",
  ],
  asleep: [
    "Huh? Someone petted me awake!",
    "I felt a pet in my dream. Do it again.",
    "Clawd woke up for a pet. Worth it.",
    "Clawd purred while asleep",
    "Mmm. Five more pets.",
    "Someone tucked me in. I think.",
  ],
};

// Someone pressed the button on the Discord status
export function petReaction(mood: Mood) {
  return pick(pettedLines[mood]);
}

// The button's total, the one part of it the user can see on their own profile
export function petCountLines(pets: number) {
  if (pets === 0) {
    return [];
  }
  return pets === 1
    ? ["I've been petted once. I remember it fondly.", "Clawd has 1 pet so far. More, please."]
    : [`I've been petted ${pets} times`, `Clawd has ${pets} pets so far. More, please.`];
}

// Something random for the card: half the lines react to the moment, a quarter to the situation
export function petChatter(mood: Mood, sessionMs: number, folder?: string, task?: string, action?: string, stats?: SessionStats, others = 0, pets = 0) {
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
  const situation = [...situationLines(mood, minutes, new Date(), folder), ...(stats ? statsLines(stats, others) : []), ...petCountLines(pets)];
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
    { type: 0, line: "I'm speedrunning this session 🏁" },
    { type: 2, line: "I'm listening to the keyboard ASMR 🎧" },
    { type: 3, line: "Clawd is watching the diff like a thriller 🎬" },
  ],
  content: [
    { type: 0, line: "I want to play. Tag, you're it! 🎮" },
    { type: 2, line: "I put on some lofi beats to wait to 🎶" },
    { type: 3, line: "I'm watching the cursor blink 👀" },
    { type: 0, line: "I'm playing fetch with myself 🎾" },
    { type: 2, line: "I'm listening to the ocean in a shell 🐚" },
    { type: 3, line: "I'm watching clouds in my wallpaper ☁" },
  ],
  hungry: [
    { type: 0, line: "I'm playing with my food 🍕" },
    { type: 2, line: "I'm listening to my tummy rumble 🎵" },
    { type: 3, line: "Clawd is watching the fridge, just in case 👀" },
    { type: 0, line: "Clawd is playing snack roulette 🎰" },
    { type: 2, line: "I'm listening for a new prompt 👂" },
    { type: 3, line: "I'm watching a cooking show 🍳" },
  ],
  asleep: [
    { type: 0, line: "I'm playing in my dreams 💤" },
    { type: 2, line: "I fell asleep to the sound of rain 🌙" },
    { type: 3, line: "Clawd is watching its dreams 😴" },
    { type: 0, line: "I'm sleepwalking through a dungeon 🗡" },
    { type: 2, line: "Clawd is listening to whale songs 🐋" },
    { type: 3, line: "I'm watching the inside of my eyelids 🌙" },
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
  [/^Linting/, [
    { type: 0, line: "I'm playing spot the difference 🔍" },
    { type: 3, line: "I'm watching the linter judge me 👀" },
  ]],
  [/^Deleting/, [{ type: 3, line: "Clawd is watching files say goodbye 👋" }]],
  [/^Talking to GitHub/, [{ type: 3, line: "I'm watching the checks turn green 🟢" }]],
  [/^Running containers/, [{ type: 0, line: "I'm playing with shipping containers 🚢" }]],
  [/^Working/, [{ type: 2, line: "I'm listening to work noises 🎧" }]],
  [/^Using a skill/, [{ type: 0, line: "I'm playing a very hard level 🎮" }]],
  [/^Working on a page/, [{ type: 0, line: "I'm playing dress-up with the page 🎨" }]],
  [/^Looking for a tool/, [{ type: 0, line: "I'm playing treasure hunt in the toolbox 🧰" }]],
  [/^Using a connector/, [{ type: 2, line: "I'm listening to the hold music 🎵" }]],
  [/^Setting a timer/, [{ type: 3, line: "I'm watching the clock 👀" }]],
  [/^Managing sessions/, [{ type: 3, line: "Clawd is watching all the other Clawds 👀" }]],
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
