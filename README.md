<div align="center">
  <img src="assets/clawd.png" alt="Clawd" width="96" height="96">
  <h1>Claude Discord Presence</h1>
</div>

> Unofficial community project. Not affiliated with or endorsed by Anthropic.

Let your friends on Discord see what Claude is working on. Claude Discord Presence shows your current Claude Code session as your Discord status, comes with a little pet called Clawd, and covers VS Code too.

<p align="center">
  <img src="assets/discord-status.gif" alt="Discord status showing Claude Code, the session name and what Claude is working on, with Clawd on the icon" width="400">
</p>

## Features

- **Follows your open chat:** the status always shows the chat you have open in the Claude app, even while another one is busy.
- **Live activity:** your session name and what Claude is doing right now, like *"Editing pet.ts in my-project"*. It takes turns with the current task list step, like *"Step 2 of 4: Run the tests"*.
- **Clawd the pet:** hover over the small icon and Clawd has something to say. Its mood follows your session, and it reacts to almost 100 situations, from the file type, the time of day and your git branch to the model, how full the context is and how many prompts you've sent.
- **Session details:** hover over the big icon to see the model, the Claude Code version and the git branch.
- **Session timer:** shows how long the session has been running.
- **VS Code status:** while no Claude app session is running, shows the file you're editing and your workspace name.
- **Autostart:** starts with Windows, if you want it to.

### What your status looks like

| Situation | Discord shows | Clawd says (on hover) |
|---|---|---|
| Claude is working | **Claude Code** · My session · Editing `pet.ts` in `my-project` | *Clawd is noodling…* |
| Waiting, under 10 min | **Claude Code** · My session · Waiting in `my-project` | *Clawd wants a new prompt, pretty please* |
| Waiting, under 1 h | **Claude Code** · My session · Waiting in `my-project` | *Clawd is hungry, feed it a prompt!* |
| Waiting longer | **Claude Code** · My session · Waiting in `my-project` | *Clawd is asleep. Zzz…* |
| Editing in VS Code, no app session | **Visual Studio Code** · Editing `extension.ts` · Workspace: `my-project` | |

The status updates at most every 15 seconds, since Discord only shows about one update in that time.

> [!NOTE]
> Anyone who can see your Discord status can read the session name, task list steps, file and folder names and the git branch. Commands, search terms and your messages are never shared.

## Requirements

- Windows
- The [Claude desktop app](https://claude.ai/download)
- [Node.js](https://nodejs.org)
- The **Discord desktop app**, running on the same PC. Discord in the browser doesn't support Rich Presence.
- In Discord, **Settings → Activity Privacy → Share your detected activities with others** turned on

## Installation

Paste this line into PowerShell:

```powershell
irm https://raw.githubusercontent.com/Kiwious/claude-presence/main/install.ps1 | iex
```

The installer asks whether it should start with Windows, whether to start it right away, and whether to install the optional VS Code extension. Feel free to [read the script](install.ps1) first.

Then open a session in the Claude app. Your status should appear within a few seconds.

To update or uninstall, run the same line again.

## Troubleshooting

- **No status at all:** check that the Discord desktop app is open, a Claude app session is running and the Activity Privacy setting is on. If it still doesn't show up, run the installer again and choose Update.
- **The status lags behind:** Discord only shows about one update every 15 seconds, so give it a moment.
- **The action only says "Working":** the status is read from Claude Code's files in `~/.claude/sessions` and `~/.claude/projects`. They aren't an official interface, so a Claude Code update can change them.
- **"Discord: connection closed" in VS Code:** Discord was closed or restarted. Run `Developer: Reload Window` to reconnect.
- **Icons are missing:** the icons belong to this project's Discord app. To use your own, create an app in the [Discord Developer Portal](https://discord.com/developers/applications), upload the icons there and put its ID in `src/client-id.ts`.

## Development

```powershell
yarn install
yarn watch
```

Press `F5` in VS Code to open an Extension Development Host with the extension loaded.

To build the `.vsix` package and the companion, then run the companion:

```powershell
yarn vsce package
node dist/companion.js
```

To run the unit tests:

```powershell
yarn test:unit
```

## Contributors

- [Kiwious](https://github.com/Kiwious): author and maintainer. VS Code extension, file type icons, releases.
- [laurensanp](https://github.com/laurensanp): Claude app companion, Clawd, session stats, open chat detection and the installer.

File type icons: see [assets/icons/LICENSE](assets/icons/LICENSE).

## License

[MIT](LICENSE)
