# Claude Discord Presence

Your Discord status for the **Claude Code desktop app**: your session name, what Claude is doing right now, and a Tamagotchi-style pet called Clawd. Fork of [Kiwious/better-presence](https://github.com/Kiwious/better-presence). Windows only so far.

## What you see

| Claude | Discord shows | Hover over Clawd |
|---|---|---|
| Working | *My session name* · *Editing pet.ts in my-project* | *Clawd is noodling…* |
| Waiting, under 10 min | *My session name* · *Waiting in my-project* | *Clawd wants a new prompt* |
| Waiting, under 1 h | *My session name* · *Waiting in my-project* | *Clawd is hungry, feed it a prompt!* |
| Waiting longer | *My session name* · *Waiting in my-project* | *Clawd is asleep. Zzz…* |

Hovering over the small Clawd icon shows the pet: its lines, its mood, how long the session has run and its folder, in random order. The status updates at most every 15 seconds, which is about how often Discord displays an update. People who can see your status can read the session name, file names and folder names. Commands and search terms are never shown.

## Setup

You need the [Claude desktop app](https://claude.ai/download), the Discord desktop app (not the browser version), [Node.js](https://nodejs.org), [Git](https://git-scm.com) and Yarn (`npm install -g yarn`). In Discord, turn on **Settings → Activity Privacy → Share your detected activities with others**.

Run these in PowerShell.

**1. Download and build**

```powershell
git clone https://github.com/laurensanp/claude-discord-presence "$HOME\claude-discord-presence"
cd "$HOME\claude-discord-presence"
yarn install --frozen-lockfile
yarn vsce package
```

**2. Install the companion and start it with Windows**

The companion is a small hidden program that sends your status to Discord.

```powershell
$dir = "$env:LOCALAPPDATA\better-presence"
New-Item -ItemType Directory -Force $dir | Out-Null
Copy-Item dist\companion.js "$dir\companion.js"
$vbs = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\better-presence-companion.vbs"
Set-Content $vbs ('CreateObject("WScript.Shell").Run """{0}"" ""{1}""", 0, False' -f (Get-Command node).Source, "$dir\companion.js")
wscript $vbs
```

Open a session in the Claude app. Your status should appear within a few seconds.

**3. Optional: the VS Code status**

This shows the file you're editing while the Claude app has no running session. VS Code profiles each have their own extensions, so for another profile run the command again with `--profile "<name>"`. Then run `Developer: Reload Window` in VS Code.

```powershell
code --install-extension (Get-Item better-vscode-presence-*.vsix).FullName --force
```

## Update

```powershell
cd "$HOME\claude-discord-presence"
git pull
yarn install --frozen-lockfile
yarn vsce package
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'better-presence.companion' } | ForEach-Object { Stop-Process -Id $_.ProcessId }
Copy-Item dist\companion.js "$env:LOCALAPPDATA\better-presence\companion.js"
wscript "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\better-presence-companion.vbs"
```

## Uninstall

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'better-presence.companion' } | ForEach-Object { Stop-Process -Id $_.ProcessId }
Remove-Item "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\better-presence-companion.vbs"
Remove-Item -Recurse "$env:LOCALAPPDATA\better-presence"
```

If you installed it, remove the extension in VS Code too.

## Troubleshooting

- **No status at all:** check that the Discord desktop app is running, that a Claude app session is open, and the Activity Privacy setting above. Then run the `wscript` line from step 2 again; a second copy exits by itself.
- **Status stays on the old text:** Discord displays about one update every 15 seconds.
- **The action only says "Working":** the companion reads Claude Code's files in `~/.claude/sessions` and `~/.claude/projects`. They aren't an official interface, so an update can change them.
- **Icons missing:** the pictures belong to the Discord app of the original project. New pictures need your own app at the [Discord Developer Portal](https://discord.com/developers/applications) and its ID in `src/client-id.ts`.

---

The rest of this page is the original project's README for the VS Code extension.

# Better Discord Presence

Show what you're working on in VS Code as your Discord status — with built-in support for [Claude Code](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code).

## Features

- **Live editing status:** shows the file you're currently editing and the name of your workspace.
- **Session timer:** displays how long you've been coding.
- **Claude Code support:** when the Claude Code tab is active, your status switches to a Claude Code badge and a rotating, whimsical message like *"Cogitating…"*, *"Percolating…"* or *"Reticulating…"*, refreshed every 15 seconds.
- **Idle state:** shows *"Idle..."* when no editor tab is open.
- **Zero configuration:** starts automatically once VS Code has finished loading.

### What your status looks like

| Situation | Discord shows |
|---|---|
| Editing a file | **Visual Studio Code** · Editing `extension.ts` · Workspace: `my-project` |
| Using Claude Code | **Visual Studio Code** · *Noodling…* · Workspace: `my-project` (with Claude Code icon) |
| Nothing open | **Visual Studio Code** · Idle... |

## Requirements

- The **Discord desktop app** must be running on the same machine. The browser version of Discord does not support Rich Presence.
- In Discord, **Settings → Activity Privacy → Share your detected activities with others** must be enabled.

## Installation

### From GitHub Releases

1. Download the latest `.vsix` file from the [Releases page](https://github.com/Kiwious/better-presence/releases).
2. Install it from the terminal:

   ```
   code --install-extension better-vscode-presence-0.0.2.vsix
   ```

   Or in VS Code: **Extensions** view → **`…`** menu → **Install from VSIX…**
3. Reload VS Code (`Developer: Reload Window`).

> Extensions installed from a `.vsix` file don't update automatically. To update, download and install the new `.vsix` from the Releases page.

You'll see a "Discord connected" notification once the extension has linked up with Discord.

## Troubleshooting

- **"Discord login failed" / no status visible:** make sure the Discord desktop app is open, then reload VS Code (`Developer: Reload Window`).
- **"Discord: connection closed":** Discord was closed or restarted. Reload VS Code to reconnect.

## Development

```
yarn install
yarn watch
```

Press `F5` in VS Code to launch an Extension Development Host with the extension loaded.

To build a `.vsix` package:

```
yarn vsce package
```

## License

[MIT](LICENSE)
