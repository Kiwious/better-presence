import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import type { AppSession } from "./app-session";

export interface ChatMeta {
  cliSessionId?: string;
  cwd?: string;
  title?: string;
  isArchived?: boolean;
  lastFocusedAt?: number;
  createdAt?: number;
  lastActivityAt?: number;
}

// The app keeps its data in one of these, depending on how it was installed
function sessionRoots() {
  const roots = [join(process.env.APPDATA ?? "", "Claude", "claude-code-sessions")];
  const packaged = join(process.env.LOCALAPPDATA ?? "", "Claude-Data");
  if (existsSync(packaged)) {
    for (const entry of readdirSync(packaged)) {
      roots.push(join(packaged, entry, "claude-code-sessions"));
    }
  }
  return roots.filter((root) => existsSync(root));
}

const cache = new Map<string, { mtimeMs: number; meta: ChatMeta }>();

function readMeta(file: string): ChatMeta | undefined {
  const { mtimeMs } = statSync(file);
  const cached = cache.get(file);
  if (cached?.mtimeMs === mtimeMs) {
    return cached.meta;
  }
  // These files hold far more than this, only the fields below are kept
  const { cliSessionId, cwd, title, isArchived, lastFocusedAt, createdAt, lastActivityAt } =
    JSON.parse(readFileSync(file, "utf8"));
  const meta = { cliSessionId, cwd, title, isArchived, lastFocusedAt, createdAt, lastActivityAt };
  cache.set(file, { mtimeMs, meta });
  return meta;
}

function readMetas() {
  const metas: ChatMeta[] = [];
  for (const root of sessionRoots()) {
    for (const account of readdirSync(root)) {
      for (const org of readdirSync(join(root, account))) {
        const dir = join(root, account, org);
        for (const file of readdirSync(dir).filter((name) => /^local_.*\.json$/.test(name))) {
          try {
            const meta = readMeta(join(dir, file));
            if (meta) {
              metas.push(meta);
            }
          } catch {
            // Being written right now, the next check sees it
          }
        }
      }
    }
  }
  return metas;
}

// The chat on screen is the one focused last. A chat whose process has ended is still shown, as waiting.
// shortcut: stays on the last chat while the app is in the background; check the foreground window if that bothers anyone
export function chooseSession(live: AppSession[], metas: ChatMeta[]): AppSession | undefined {
  const open = metas
    .filter((meta) => meta.cliSessionId && meta.cwd && meta.lastFocusedAt && !meta.isArchived)
    .sort((a, b) => b.lastFocusedAt! - a.lastFocusedAt!)[0];
  if (!open) {
    return live[0];
  }
  return (
    live.find((session) => session.sessionId === open.cliSessionId) ?? {
      pid: 0,
      sessionId: open.cliSessionId!,
      cwd: open.cwd!,
      name: open.title,
      status: "idle",
      startedAt: open.createdAt ?? open.lastFocusedAt!,
      updatedAt: open.lastActivityAt,
    }
  );
}

export function findOpenChat(live: AppSession[]) {
  try {
    return chooseSession(live, readMetas());
  } catch {
    return live[0];
  }
}
