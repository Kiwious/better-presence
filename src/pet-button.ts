import { readFileSync } from "fs";
import { join } from "path";

// Optional and local: holds the address of the deployed worker/. Without it there is no button.
const URL_FILE = join(process.env.LOCALAPPDATA ?? "", "better-presence", "clawd-button.txt");

// An invalid button would make Discord reject the whole activity
export function parsePetUrl(text: string) {
  const url = text.trim().replace(/\/+$/, "");
  return /^https:\/\/\S{1,480}$/.test(url) ? url : undefined;
}

export function readPetUrl() {
  try {
    return parsePetUrl(readFileSync(URL_FILE, "utf8"));
  } catch {
    return undefined;
  }
}

export function petButtons(url?: string) {
  return url ? [{ label: "Pet Clawd", url: `${url}/pet` }] : undefined;
}

// The worker's answer comes from the internet, so only a plain count gets through
export function parsePetCount(body: any) {
  const count = body?.count;
  return Number.isSafeInteger(count) && count >= 0 ? (count as number) : undefined;
}
