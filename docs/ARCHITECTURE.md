# Architecture (draft)

> Status: **proposal**. Implemented so far: the VS Code extension and `packages/core`.

Claude Presence shows what you are doing with Claude as your Discord Rich Presence, whether you work in the terminal (Claude Code), in VS Code, or in the Claude desktop app.

## Goals

- **One Discord status for all sources.** Claude Code sessions, VS Code and (optionally) Claude Desktop feed a single presence instead of fighting over it.
- **Real states, not just "app is open":** thinking, editing a file, running a command, waiting for approval, idle.
- **Never slow Claude down.** Hooks fire and forget. If the daemon is down, Claude keeps working normally.
- **Private by default.** Prompt text is never shown, stored or logged. File and project names can be turned off.
- **Cross-platform:** Windows, macOS, Linux.

## Non-goals

- Reading Claude's UI, local app databases or chat contents.
- Showing presence for other people or syncing across machines.

## Overview

```
 ┌────────────────────┐   HTTP POST (raw hook JSON)
 │ Claude Code        │ ─────────────────────────────┐
 │  + plugin hooks    │                              │
 └────────────────────┘                              ▼
 ┌────────────────────┐   HTTP POST (PresenceEvent) ┌──────────────────────────┐   IPC (named pipe /   ┌─────────┐
 │ VS Code extension  │ ──────────────────────────▶ │ presence daemon          │ ────unix socket)────▶ │ Discord │
 └────────────────────┘                             │  normalize → sessions →  │                       └─────────┘
 ┌────────────────────┐   HTTP POST (PresenceEvent) │  arbitrate → throttle    │
 │ Claude Desktop MCP │ ──────────────────────────▶ │  127.0.0.1 only          │
 │  (optional)        │                             └──────────────────────────┘
 └────────────────────┘
```

Why a daemon? A Discord client ID can only show **one** activity per user. If the VS Code extension and several Claude Code sessions each set the activity, they overwrite each other. With the daemon, only **one** process owns the Discord connection, and it decides what is shown.

## Monorepo layout

Yarn workspaces:

```
claude-presence/
├─ packages/
│  ├─ core/                 # pure TypeScript, no I/O: types, normalizers, session state, arbitration, presence mapping
│  │  ├─ src/
│  │  │  ├─ events.ts       # PresenceEvent
│  │  │  ├─ claude-code.ts  # raw hook JSON → PresenceEvent
│  │  │  ├─ sessions.ts     # per-session state machine, expiry, which session wins
│  │  │  └─ presence.ts     # session → Discord activity, privacy settings
│  │  └─ test/              # node:test, run with `node --test` (no build step)
│  ├─ daemon/               # HTTP server, Discord connection, reconnect, throttling, lifecycle
│  ├─ claude-code-plugin/   # Claude Code plugin: manifest, hooks.json, ensure-daemon script
│  │  ├─ .claude-plugin/plugin.json
│  │  ├─ hooks/hooks.json
│  │  └─ scripts/ensure-daemon.js
│  ├─ vscode/               # the current extension, moved here
│  └─ mcp/                  # optional: Claude Desktop "app is open" module
├─ docs/
└─ package.json             # workspaces, shared scripts
```

`core` holds all the logic and has no dependencies on Node, VS Code or Discord. That makes it fully unit-testable, and the other packages stay thin.

## Transport

The daemon listens on **`127.0.0.1:47320`** (default port, configurable). It never binds to `0.0.0.0`.

| Method | Path | Body | Used by |
|---|---|---|---|
| `POST` | `/v1/hooks/claude-code` | raw Claude Code hook input JSON | Claude Code plugin (`http` hooks) |
| `POST` | `/v1/events` | `PresenceEvent` or `PresenceEvent[]` | VS Code extension, MCP module |
| `GET` | `/v1/health` | → `{ name, version, protocol: 1, discord: "connected" \| "connecting" \| "disconnected" }` | `ensure-daemon`, VS Code extension |
| `GET` | `/v1/state` | → current sessions + chosen activity | debugging, tests |

The daemon answers every `POST` immediately with `204` and does the work afterwards, so hooks never wait on Discord.

**Protection against browsers:** websites can send requests to `localhost`. Every `POST` must carry the header `X-Claude-Presence: 1`. A custom header forces a CORS preflight, and the daemon never answers it with CORS headers, so browsers cannot send events. Requests with an `Origin` header are rejected.

### Why the daemon receives raw hook JSON

Claude Code `http` hooks POST the hook input as-is. Normalizing in the daemon means:

- the plugin needs **no scripts per event**, so there is no process start per tool call and no shell or Windows quoting issues,
- new hook fields can be supported by updating the daemon only.

The raw payload contains the prompt text (`UserPromptSubmit`). The normalizer drops it right away. It is never stored, logged or forwarded.

## Event protocol

```ts
// packages/core/src/events.ts
export type Source = "claude-code" | "vscode" | "claude-desktop";

export interface PresenceEvent {
  v: 1;
  source: Source;
  sessionId: string;   // Claude Code: session_id; VS Code: window id; MCP: process id
  ts: number;          // ms since epoch, set by the daemon if missing
  type: EventType;
  data?: EventData;
}

export type EventType =
  | "session.start"
  | "session.end"
  | "prompt.submit"     // a turn starts, Claude is thinking
  | "tool.start"
  | "tool.end"
  | "subagent.start"
  | "subagent.end"
  | "attention.needed"  // permission prompt, question to the user
  | "turn.stop"         // Claude finished, waiting for input
  | "editor.focus"      // VS Code: a file is active
  | "editor.idle"       // VS Code: no editor open
  | "heartbeat";

export interface EventData {
  project?: string;     // basename of cwd / workspace name
  title?: string;       // custom session title, if set
  model?: string;
  tool?: string;        // e.g. "Edit", "Bash", "mcp__github__create_pull_request"
  file?: string;        // basename only, never a full path
  language?: string;    // VS Code languageId
  reason?: string;      // session.end / attention.needed detail
  error?: boolean;      // turn.stop after StopFailure / tool.end after failure
}
```

### Mapping Claude Code hooks → events

| Hook event | Event | Data taken from hook input |
|---|---|---|
| `SessionStart` | `session.start` | `cwd` → `project`, `session_title` → `title`, `model` |
| `UserPromptSubmit` | `prompt.submit` | `session_title` → `title` (**`prompt` is dropped**) |
| `PreToolUse` | `tool.start` | `tool_name` → `tool`; for `Edit`/`Write`/`Read`/`NotebookEdit`: basename of `tool_input.file_path` → `file` |
| `PostToolUse` | `tool.end` | `tool_name` |
| `PostToolUseFailure` | `tool.end` | `tool_name`, `error: true` |
| `SubagentStart` / `SubagentStop` | `subagent.start` / `subagent.end` | `agent_type` |
| `Notification` (`permission_prompt`, `elicitation_dialog`, `agent_needs_input`) | `attention.needed` | `notification_type` → `reason` |
| `Notification` (`idle_prompt`) | `turn.stop` | |
| `Stop` | `turn.stop` | |
| `StopFailure` | `turn.stop` | `error: true` |
| `SessionEnd` | `session.end` | reason |

Every hook also carries `session_id`, which becomes `sessionId`. That way parallel sessions in different terminals stay separate.

## Session state

Each `(source, sessionId)` has its own small state machine:

```
           session.start
                │
                ▼
   ┌──────▶  idle  ◀────────────── turn.stop
   │            │                       ▲
   │      prompt.submit                 │
   │            ▼                       │
   │       thinking ──tool.start──▶ tool(name, file)
   │            ▲                       │
   │            └──────tool.end─────────┘
   │
   │   attention.needed (from thinking/tool) ──▶ waiting  ──(next tool.start / prompt.submit / turn.stop)──▶ …
   │
   └── session.end / no event for 30 min ──▶ removed
```

- The **stale timeout** matters: a crashed terminal never sends `SessionEnd`.
- A session also keeps a **subagent counter** and `startedAt` for the Discord timer.
- VS Code sessions have just two states: `editing(file)` and `idle`.

## Arbitration

Several sessions can be active at the same time. The daemon shows the one with the highest rank. Ties go to the most recent event.

| Rank | State |
|---|---|
| 1 | Claude `waiting` (needs you) |
| 2 | Claude `thinking` / `tool` |
| 3 | VS Code `editing` |
| 4 | Claude `idle` |
| 5 | VS Code `idle` |

When no session is left, the daemon clears the activity.

## Presence mapping

| State | `details` | `state` | Small image |
|---|---|---|---|
| thinking | rotating message ("Cogitating…") | `Project my-app` or session title | `thinking` |
| tool `Edit`/`Write` | `Editing main.ts` | project | `edit` |
| tool `Read`/`Grep`/`Glob` | `Reading the codebase` | project | `read` |
| tool `Bash` | `Running a command` | project | `terminal` |
| tool `WebFetch`/`WebSearch` | `Researching` | project | `web` |
| tool `Agent`/subagents > 0 | `Working with 3 subagents` | project | `agents` |
| tool `mcp__<server>__*` | `Using <server>` | project | `plug` |
| waiting | `Waiting for approval` | project | `attention` |
| idle | `Waiting for input` | project | `idle` |
| VS Code editing | `Editing main.ts` | `Workspace my-app` | language icon |

- Large image: the Claude Code logo for Claude sessions, the VS Code logo otherwise.
- Timestamp: `startedAt` of the shown session.
- Rotating messages change at most every 15 seconds and only while `thinking`.

## Daemon lifecycle

- **Start:** the Claude Code `SessionStart` hook runs `ensure-daemon.js`. The VS Code extension does the same on activation. Both check `GET /v1/health`. If nothing answers, they start the daemon as a **detached** background process and exit. The daemon is bundled into both packages, so neither depends on the other being installed.
- **Single instance:** binding the port is the lock. A second daemon that cannot bind checks `/v1/health`. If a compatible daemon (same `protocol`) answers, it exits quietly.
- **Stop:** the daemon exits after 10 minutes without any session.
- **Discord connection:** the daemon connects lazily on the first event and reconnects with exponential backoff (1 s → 2 s → … → 60 s) when Discord is closed or restarted.
- **Throttling:** Discord limits activity updates (roughly 5 per 20 seconds). The daemon coalesces updates: it sends at most one every 4 seconds and always sends the latest state (trailing edge). Identical activities are not sent again.

## Claude Code plugin

```jsonc
// packages/claude-code-plugin/hooks/hooks.json (sketch)
{
  "description": "Send Claude Code activity to the Claude Presence daemon",
  "hooks": {
    "SessionStart": [
      { "hooks": [
        { "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/ensure-daemon.js\"", "timeout": 5 },
        { "type": "http", "url": "http://127.0.0.1:47320/v1/hooks/claude-code",
          "headers": { "X-Claude-Presence": "1" }, "timeout": 2 }
      ] }
    ],
    "UserPromptSubmit": [ { "hooks": [ { "type": "http", "url": "http://127.0.0.1:47320/v1/hooks/claude-code", "headers": { "X-Claude-Presence": "1" }, "timeout": 2 } ] } ],
    "PreToolUse":       [ { "matcher": "*", "hooks": [ /* same http hook */ ] } ]
    // … PostToolUse, PostToolUseFailure, SubagentStart, SubagentStop, Notification, Stop, StopFailure, SessionEnd
  }
}
```

Open questions to check against the Claude Code docs during implementation:

- [ ] Exact body format that `http` hooks send, and how a refused connection (daemon down) is reported. It must not block the user or show noisy errors. If needed, use `"onFailure": "continue"`, or fall back to `async` command hooks that forward stdin.
- [ ] Whether the hook `url` can use a plugin option (`userConfig`) for the port, or whether the port has to stay fixed.
- [ ] Exact name of the reason field in `SessionEnd` input.

## Configuration and privacy

One config file per user (`~/.config/claude-presence/config.json`, `%APPDATA%\claude-presence\config.json` on Windows), editable from VS Code settings as well:

| Option | Default | Effect |
|---|---|---|
| `showFileNames` | `true` | Otherwise "Editing a file" |
| `showProjectName` | `true` | Otherwise no project line |
| `showSessionTitle` | `false` | Custom titles can contain private information |
| `showClaudeSessions` | `true` | Turn off the Claude Code part |
| `idleTimeoutMinutes` | `30` | Stale session timeout |
| `port` | `47320` | |

Never shown, under any setting: prompt text, full paths, tool input other than the file basename, assistant messages.

## Testing

- **core:** unit tests with recorded hook payloads as fixtures (`test/fixtures/claude-code/*.json`): normalizer output, state transitions, arbitration and presence mapping. No Discord, no network.
- **daemon:** integration tests with a fake Discord client: POST events over HTTP, assert the throttled activity sequence, test reconnect and stale timeout with fake timers.
- **vscode:** the existing `@vscode/test-electron` setup, with the daemon client mocked.
- **CI:** GitHub Actions on Windows, macOS and Linux runs lint, typecheck and tests. Tags build the `.vsix`, publish to the VS Code Marketplace and Open VSX, and create a GitHub release.

## Roadmap

1. Move to yarn workspaces and move the extension to `packages/vscode` (no behaviour change).
2. `packages/core`: types, normalizers, state machine, arbitration, mapping, with tests.
3. `packages/daemon`: HTTP server, Discord connection with reconnect and throttling, lifecycle.
4. `packages/claude-code-plugin`: manifest, hooks, `ensure-daemon`. Answer the open questions above.
5. VS Code extension becomes a daemon client. Its own Claude-tab detection stays as a fallback when no Claude Code session is reported.
6. Configuration, CI, Marketplace release, README with GIF.
7. Optional: `packages/mcp` for "Claude Desktop is open".
