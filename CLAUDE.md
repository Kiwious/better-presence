# Claude Discord Presence

Discord status for the Claude Code desktop app with a pet, Clawd, plus a VS Code status. MIT, Windows only.

Repository: `github.com/Kiwious/claude-presence` (was `better-presence`). Changes from outside arrive as pull requests. In this clone `origin` is that repo, without write access; `fork` is `laurensanp/claude-discord-presence`, and PRs come from its `main`, so while one is open, pushes to it land in that PR.

| Path | What |
|---|---|
| `src/companion.ts` | separate process (`dist/companion.js`): shows the app's session on Discord |
| `src/app-session.ts` | finds running app sessions (`~/.claude/sessions`), parses the current action |
| `src/open-chat.ts` | picks the chat on screen: newest `lastFocusedAt` in the app's `claude-code-sessions/**/local_*.json` |
| `src/session-stats.ts` | action, counts, model, branch, context, task list from the transcript, read incrementally |
| `src/pet.ts` | Clawd: mood, lines, situations, reactions to the stats |
| `src/pet-state.ts` | local only: writes `clawd-state.json` for the add-on Clawd Buddy (`laurensanp/clawd-buddy`: line and activity token), removes it when the app closes so it quits, starts it if `clawd-pet.txt` names its `start-clawd.vbs` |
| `src/pet-button.ts`, `worker/` | optional "Pet Clawd" button: `clawd-button.txt` names the deployed Cloudflare Worker; the button opens its `/pet` page, the companion checks `/count` every 5 s and Clawd reacts. Stores only a count |
| `src/discord-client.ts`, `src/extension.ts` | VS Code extension; clears its status while an app session runs |
| `src/asset-text.ts` | fits text into Discord's limit |
| `src/client-id.ts` | Discord app ID; the app and its icons (`claude-code`, `clawd`) belong to Kiwious |
| `install.ps1` | one-line installer, also updates, removes and sets up the Pet Clawd button. Keep it ASCII, Windows PowerShell can misread other characters through `irm` |

## Behaviour to keep

- Discord rejects the whole activity if asset text is outside 2-128 characters, and the library ignores the error, so the status just disappears. Send asset text through `assetText`.
- The companion sends activity type 5 (Competing): in a test Discord listed it above a running game (user's wish), below the user's own Go Live stream. The order isn't documented. Discord rejects type 1 (Streaming) from apps.
- About every 2.5 min, for a minute, Clawd picks Playing, Listening or Watching instead and says why in the tooltip (`petWish`, user's wish). Only Competing is confirmed above a game, so a wish may fall below it for that minute.
- The companion shows the status while a `claude.exe` that loads `claude-native-binding.node` runs (only the app's main process does, also while in the tray), checked every 2 s. Session processes don't count: the app ends idle ones while staying open, and ending its task can leave one behind. If an update renames that module, the status and pet stop working. A chat without a process shows as waiting. The extension still treats no process as no app session.
- Clawd says "I" in most lines and sometimes its name (user's wish). Keep both when adding lines.
- The companion checks every second and sends at most every 15 s, which is the user's choice given Discord's limit of about one update per 15 s.
- The card shows the session name, and the action taking turns with the task list step. Clawd only appears in the small icon's tooltip (user's wish).
- Only file, folder and branch names and task list steps go to Discord. Commands, search terms and messages never do (`describeTool`, `applyEntry` keeps no text). A command only shows as a fixed kind like "Running the tests" (`commandKinds`).
- Half of Clawd's lines react to the moment (`momentLines`: action, failure, interruption, streak), a quarter to the situation, and `pick` gives every fitting line a turn before any repeats (user's wish). A new action in `describeTool` needs an entry in `reactions`.
- A Discord button can only open a link, so a press reaches this PC through the worker. Without `clawd-button.txt` there is no button and no request. The address is never in the repo; the installer deploys it to the user's own Cloudflare account. Wrangler's output can't be piped there, or it stops asking for a subdomain and registers one by itself.
- The app's task list tool (`mcp__ccd_turn__*`) is skipped when reading the action, else it hides the real one.
- `~/.claude` session files and the app's chat files aren't an official interface; an update can change them. `cmdk-navigation-history` in the app's Session Storage doesn't follow chat switches, the window title is only `Claude`.
- A companion started from a Claude Code session dies when the app restarts. The autostart one isn't affected.
- Open: about half of test connections got no reply to the Discord handshake, cause unknown. The companion reconnects, the extension doesn't.

## Build and test

- Build: `yarn vsce package` (runs types and lint, writes `dist/` and the `.vsix`).
- Unit tests: `yarn test:unit` (compiles to `out/`, runs mocha). CI runs types, lint and unit tests on every push and pull request.
- Against Discord: run a copy of `dist/companion.js` with the pipe name `better-presence-companion` changed, else it exits because the installed one holds the pipe.
- Installer tests: set `LOCALAPPDATA` and `APPDATA` to a temp folder and pipe the answers in. It still stops the real companion, so start that again afterwards. For the button, also point `XDG_CONFIG_HOME` at `%APPDATA%\xdg.config` to keep the Cloudflare login, and use a test worker name, because removing deletes the worker.

## Install paths

Companion: `%LOCALAPPDATA%\better-presence\companion.js`, autostart: `better-presence-companion.vbs` in the Windows startup folder. The extension ID stays `kevinpartizan.better-vscode-presence` and these paths keep the old name, so updates and removal keep working for existing installs. To apply a new build locally, stop the `node.exe` running the companion, copy `dist/companion.js` over and run the `.vbs` with `wscript`. The installer asks for each VS Code profile whether to install the extension there.

## Releases

Bump `version` in `package.json`, then push a `v*` tag: `.github/workflows/release.yml` publishes `companion.js`, `claude-discord-presence.vsix`, `pet-worker.js` and `pet-worker.toml`. Keep these asset names, the installer downloads them from `releases/latest/download`. The newest release on the fork is v0.6.0; on Kiwious' repo v0.4.0.
