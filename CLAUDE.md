# Claude Discord Presence

Discord status for the Claude Code desktop app with a pet, Clawd, plus the original VS Code status. Fork of Kiwious' project (`github.com/Kiwious/claude-presence`, was `better-presence`, MIT). Windows only.

Repository: `github.com/laurensanp/claude-discord-presence`. Remotes in this clone: `fork` (ours), `origin` (Kiwious). Work happens on the local branch `fix/session-title-length`, pushed as `fix/session-title-length:main` to `fork`. PR Kiwious/claude-presence#2 (up to `fe22b19`) is merged upstream; later work on fork `main` needs a new PR.

| Path | What |
|---|---|
| `src/companion.ts` | separate process (`dist/companion.js`): shows the app's session on Discord |
| `src/app-session.ts` | finds the app session (`~/.claude/sessions`), reads the current action (transcript tail in `~/.claude/projects`) |
| `src/session-stats.ts` | counts, model, branch, context, task list from the transcript, read incrementally |
| `src/pet.ts` | Clawd: mood, lines, situations, reactions to the stats |
| `src/discord-client.ts`, `src/extension.ts` | VS Code extension; clears its status while an app session runs |
| `src/asset-text.ts` | fits text into Discord's limit |
| `src/client-id.ts` | Discord app ID; the app and its icons (`claude-code`, `clawd`) belong to Kiwious |
| `install.ps1` | one-line installer, also updates and removes |

## Behaviour to keep

- Discord rejects the whole activity if asset text is outside 2-128 characters, and the library ignores the error, so the status just disappears. Send asset text through `assetText`.
- The companion checks every second and sends at most every 15 s, which is the user's choice given Discord's limit of about one update per 15 s.
- The card shows the session name, and the action taking turns with the task list step. Clawd only appears in the small icon's tooltip (user's wish).
- Only file, folder and branch names and task list steps go to Discord. Commands, search terms and messages never do (`describeTool`, `applyEntry` keeps no text).
- The app's task list tool (`mcp__ccd_turn__*`) is skipped when reading the action, else it hides the real one.
- `~/.claude` session files aren't an official interface; an update can change them.
- Open: about half of test connections got no reply to the Discord handshake, cause unknown. The companion reconnects, the extension doesn't.

## Build and test

- Build: `yarn vsce package` (runs types and lint, writes `dist/` and the `.vsix`).
- Tests: `npx tsc -p . --outDir <temp>`, then `NODE_PATH=node_modules npx mocha --ui tdd <temp>/test/pet.test.js <temp>/test/app-session.test.js`. `yarn test` (vscode-test) wasn't used.
- Against Discord: run a copy of `dist/companion.js` with the pipe name `better-presence-companion` changed, else it exits because the installed one holds the pipe.
- Installer tests: set `LOCALAPPDATA` and `APPDATA` to a temp folder and pipe the answers in. It still stops the real companion, so start that again afterwards.

## Install on the user's PC

Companion: `%LOCALAPPDATA%\better-presence\companion.js`, autostart: `better-presence-companion.vbs` in the Windows startup folder. To apply a new build, stop the `node.exe` running it, copy `dist/companion.js` over and run the `.vbs` with `wscript`. VS Code has two profiles, and the extension must be installed in each (`--profile`).

## Releases

`gh release create` on the fork with `companion.js` and `claude-discord-presence.vsix`. Keep these asset names, the installer downloads them from `releases/latest/download`. Bump `version` in `package.json`. The newest release is v0.1.0; its `.vsix` still has the old README.
