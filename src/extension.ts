import { commands, ExtensionContext, window, workspace } from "vscode";
import { CLIENT_ID } from "./client-id";
import { DiscordClient } from "./discord-client";

export function activate(context: ExtensionContext) {
  const client = new DiscordClient({
    clientId: CLIENT_ID,
    window,
    workspace: workspace.name,
  });

  context.subscriptions.push(
    window.onDidChangeActiveTextEditor(() =>
      client.onDidChangeActiveTextEditor(),
    ),
    window.tabGroups.onDidChangeTabs(() => client.update()),
    window.tabGroups.onDidChangeTabGroups(() => client.update()),
  );
}

export function deactivate() {}
