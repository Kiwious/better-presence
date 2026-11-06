import { existsSync, readFileSync } from "fs";
import { join } from "path";

// A token from `claude setup-token`, saved by the user. It can't read the usage endpoint (no user:profile scope),
// but a model request carries the 5h reset in its reply headers.
const TOKEN_FILE = join(process.env.LOCALAPPDATA ?? "", "better-presence", "usage-token.txt");
const RETRY_MS = 10 * 60 * 1000;

let reset: number | undefined;
let askedAt = 0;

// Only while Claude works: a request outside a running window would start one itself
export function shouldAsk(busy: boolean, known: number | undefined, askedAt: number, now: number) {
  return busy && known === undefined && now - askedAt >= RETRY_MS;
}

export function resetFromHeaders(headers: Headers) {
  const seconds = Number(headers.get("anthropic-ratelimit-unified-5h-reset"));
  return seconds > 0 ? seconds * 1000 : undefined;
}

async function ask(token: string) {
  // shortcut: fixed model id, the countdown stops when it is retired; update it then
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "anthropic-beta": "oauth-2025-04-20",
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-5-5",
      // Nothing is generated, the reply still carries the limit headers
      max_tokens: 0,
      system: "You are Claude Code, Anthropic's official CLI for Claude.",
      messages: [{ role: "user", content: "hi" }],
    }),
  });
  reset = resetFromHeaders(response.headers);
}

// The 5h limit reset, if known; asks Anthropic in the background when it may
export function limitReset(busy: boolean, now = Date.now()) {
  if (reset !== undefined && reset <= now) {
    reset = undefined;
  }
  if (shouldAsk(busy, reset, askedAt, now) && existsSync(TOKEN_FILE)) {
    askedAt = now;
    ask(readFileSync(TOKEN_FILE, "utf8").trim()).catch(() => undefined);
  }
  return reset;
}
