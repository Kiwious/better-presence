// Discord rejects the whole activity unless asset text is 2-128 characters
export function assetText(label: string) {
  const text = label.trim();
  if (text.length < 2) {
    return "Claude Code";
  }
  return text.length > 128 ? `${text.slice(0, 127)}…` : text;
}
