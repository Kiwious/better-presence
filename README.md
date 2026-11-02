# Claude Discord Presence

Show what you're working on in the Claude Code desktop app as your Discord status — with a Tamagotchi-style pet called Clawd and a status for VS Code too.

## Features

- **Follows your open chat:** the status shows the chat you have open in the Claude app, even if another one is working.
- **Live activity:** shows your session name and what Claude is doing right now, like *"Editing pet.ts in my-project"*, taking turns with the current task list step, like *"Step 2 of 4: Run the tests"*.
- **Clawd the pet:** hover over the small icon and Clawd talks. Its mood follows your session, and it reacts to almost 100 situations: what Claude is doing, the file type, the time, the day, long sessions, your project, your git branch, the model, how many edits, commands and prompts you've made, how full the context is, the task list and your other open sessions.
- **Model:** hover over the big icon to see which model is running, like *"Opus 5.5 · Claude Code"*.
- **Session timer:** displays how long the session has been running.
- **VS Code status:** shows the file you're currently editing and the name of your workspace while no Claude app session is running.
- **Autostart:** starts with Windows if you want it to.

### What your status looks like

| Situation | Discord shows | Hover over Clawd |
|---|---|---|
| Claude is working | **Claude Code** · My session · Editing `pet.ts` in `my-project` | *Clawd is noodling…* |
| Waiting, under 10 min | **Claude Code** · My session · Waiting in `my-project` | *Clawd wants a new prompt, pretty please* |
| Waiting, under 1 h | **Claude Code** · My session · Waiting in `my-project` | *Clawd is hungry, feed it a prompt!* |
| Waiting longer | **Claude Code** · My session · Waiting in `my-project` | *Clawd is asleep. Zzz…* |
| Editing in VS Code, no app session | **Visual Studio Code** · Editing `extension.ts` · Workspace: `my-project` | |

The status updates at most every 15 seconds, which is about how often Discord displays an update.

> People who can see your status can read the session name, task list steps, file names, folder names and the git branch. Commands, search terms and your messages are never shown.

## Requirements

- Windows.
- The [Claude desktop app](https://claude.ai/download).
- [Node.js](https://nodejs.org).
- The **Discord desktop app** must be running on the same machine. The browser version of Discord does not support Rich Presence.
- In Discord, **Settings → Activity Privacy → Share your detected activities with others** must be enabled.

## Installation

Paste this into PowerShell:

```powershell
irm https://raw.githubusercontent.com/Kiwious/claude-presence/main/install.ps1 | iex
```

It asks whether to start with Windows, whether to start now, and whether to install the optional VS Code extension. You can [read the script](install.ps1) first.

Open a session in the Claude app and your status should appear within a few seconds.

To update or remove it, run the same line again.

## Troubleshooting

- **No status visible:** make sure the Discord desktop app is open, a Claude app session is running and the Activity Privacy setting is on. Then run the installer again and choose Update.
- **Status stays on the old text:** Discord displays about one update every 15 seconds.
- **The action only says "Working":** the companion reads Claude Code's files in `~/.claude/sessions` and `~/.claude/projects`. They aren't an official interface, so an update can change them.
- **"Discord: connection closed" in VS Code:** Discord was closed or restarted. Reload VS Code to reconnect (`Developer: Reload Window`).
- **Icons missing:** the pictures belong to the Discord app of the original project. New pictures need your own app at the [Discord Developer Portal](https://discord.com/developers/applications) and its ID in `src/client-id.ts`.

## Development

```
yarn install
yarn watch
```

Press `F5` in VS Code to launch an Extension Development Host with the extension loaded.

To build the `.vsix` package and the companion, then run the companion:

```
yarn vsce package
node dist/companion.js
```

## License

[MIT](LICENSE)
