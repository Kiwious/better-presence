import { basename } from "node:path";
import type { TextDocument } from "vscode";
import languages from "./data/languages.json";

// Discord accepts https URLs as asset keys, so the icons are served straight from the repo
const ICON_BASE =
  "https://raw.githubusercontent.com/Kiwious/claude-presence/main/assets/icons";

export const VSCODE_ICON = `${ICON_BASE}/vscode.png`;

// Keys are "/pattern/flags" regexes or plain filename suffixes (mapping taken from vscord)
function toRegex(key: string) {
  const match = /^\/(.+)\/([a-z]*)$/i.exec(key);
  if (match) {
    try {
      return new RegExp(match[1], match[2]);
    } catch {
      return undefined;
    }
  }
  return new RegExp(`${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
}

const byExtension = Object.entries(languages.KNOWN_EXTENSIONS).flatMap(
  ([key, { image }]) => {
    const regex = toRegex(key);
    return regex ? [{ regex, image }] : [];
  },
);

const byLanguageId = new Map(
  languages.KNOWN_LANGUAGES.map(({ language, image }) => [language, image]),
);

export function fileIcon(document: TextDocument) {
  const filename = basename(document.fileName);
  const image =
    byExtension.find(({ regex }) => regex.test(filename))?.image ??
    byLanguageId.get(document.languageId) ??
    "text";
  return `${ICON_BASE}/${image}.png`;
}
