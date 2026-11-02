import { commands, ExtensionContext, window, workspace } from "vscode";
import { DiscordClient } from "./discord-client";

export function activate(context: ExtensionContext) {
  const clientId = "1566825700424679424";

  if (!clientId) {
    window.showErrorMessage("DISCORD_CLIENT_ID is missing");
    return;
  }

  const client = new DiscordClient({
    clientId,
    window,
    workspace: workspace.name,
  });

  context.subscriptions.push(
    window.onDidChangeActiveTextEditor((e) =>
      client.onDidChangeActiveTextEditor(e),
    ),
    window.tabGroups.onDidChangeTabs(() => client.update()),
    window.tabGroups.onDidChangeTabGroups(() => client.update()),
  );
}

export function deactivate() {}
