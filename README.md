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
| Editing a file | **Visual Studio Code** · Editing `extension.ts` · Workspace `my-project` |
| Using Claude Code | **Visual Studio Code** · *Noodling…* · Workspace `my-project` (with Claude Code icon) |
| Nothing open | **Visual Studio Code** · Idle... |

## Requirements

- The **Discord desktop app** must be running on the same machine. The browser version of Discord does not support Rich Presence.
- In Discord, **Settings → Activity Privacy → Share your detected activities with others** must be enabled.

## Installation

### From GitHub Releases

1. Download the latest `.vsix` file from the [Releases page](https://github.com/Kiwious/better-presence/releases).
2. Install it from the terminal:

   ```
   code --install-extension better-vscode-presence-0.0.1.vsix
   ```

   Or in VS Code: **Extensions** view → **`…`** menu → **Install from VSIX…**
3. Reload VS Code (`Developer: Reload Window`).

> Extensions installed from a `.vsix` file don't update automatically. To update, download and install the new `.vsix` from the Releases page.

You'll see a "Discord connected" notification once the extension has linked up with Discord.

## Troubleshooting

- **"Discord login failed" / no status visible:** make sure the Discord desktop app is open, then reload VS Code (`Developer: Reload Window`).
- **"Discord: connection closed":** Discord was closed or restarted. Reload VS Code to reconnect.

## Development

This is a Yarn workspaces monorepo. The extension lives in `packages/vscode`.

```
yarn install
yarn workspace better-vscode-presence watch
```

Open the repository root in VS Code and press `F5` to launch an Extension Development Host with the extension loaded.

To build a `.vsix` package (written to `packages/vscode/`):

```
yarn workspace better-vscode-presence vsix
```

## License

[MIT](LICENSE)
