import { Client } from "@nxenjs/discord-rich-presence";
import { TabInputWebview, window, type Tab, type TextEditor } from "vscode";
import { findAppSession } from "./app-session";
import { assetText } from "./asset-text";
import { messages } from "./messages";

// Chat tabs get renamed to the session title, so match the webview type instead of the label
function isClaudeCodeTab(tab: Tab) {
  return (
    tab.input instanceof TabInputWebview &&
    tab.input.viewType.endsWith("claudeVSCodePanel")
  );
}

interface Settings {
  clientId: string;
  window: typeof window;
  workspace?: string;
}

export class DiscordClient extends Client {
  public window: typeof window;
  public workspace: string | undefined;

  private tabs: Tab[];
  private interval: NodeJS.Timeout | undefined;
  private startedAt: number | undefined = Date.now();
  private appOpen = false;

  public constructor({ clientId, window, workspace }: Settings) {
    super();
    this.window = window;
    this.workspace = workspace;
    this.tabs = [];

    this.once("ready", () => {
      this.window.showInformationMessage("Discord connected");
      this.update();
      setInterval(() => {
        if (this.connected && this.appOpen !== Boolean(findAppSession())) {
          this.update();
        }
      }, 5_000);
    });
    this.on("error", (err) =>
      this.window.showErrorMessage(`Discord RPC error: ${err.message}`),
    );
    this.on("close", () =>
      this.window.showWarningMessage("Discord: connection closed"),
    );
    this.login(clientId).catch((err) =>
      this.window.showErrorMessage(`Discord login failed: ${err.message}`),
    );
  }

  public update() {
    clearInterval(this.interval);
    this.interval = undefined;

    // The companion shows the Claude Code app, which wins over VS Code
    this.appOpen = Boolean(findAppSession());
    if (this.appOpen) {
      return this.setActivity(null);
    }

    if (this.startedAt === undefined) {
      this.startedAt = Date.now();
    }

    const tab = this.window.tabGroups.activeTabGroup.activeTab;
    const claudeTab = this.window.tabGroups.all
      .map((group) => group.activeTab)
      .find((t) => t && isClaudeCodeTab(t));
    if (!tab) {
      this.startedAt = undefined;
      return this.setActivity({
        name: "Visual Studio Code",
        details: "Idle...",
        timestamps: {
          start: Date.now(),
        },
      });
    }

    if (claudeTab) {
      this.setClaudeCodeActivity(claudeTab.label);
      this.interval = setInterval(() => {
        this.setClaudeCodeActivity(claudeTab.label);
      }, 15_000);
    } else {
      this.setActivity({
        name: "Visual Studio Code",
        details: `Editing ${tab.label}`,
        state: this.workspace ? `Workspace: ${this.workspace}` : "No Workspace",
        timestamps: {
          start: this.startedAt,
        },
      });
    }
  }

  public pushTabs() {
    this.tabs = [];
    for (const group of this.window.tabGroups.all) {
      if (!group.activeTab) {
        continue;
      }
      this.tabs.push(group.activeTab);
    }
  }

  public onDidChangeActiveTextEditor() {
    this.update();
  }

  private setClaudeCodeActivity(sessionName: string) {
    const message = messages[Math.floor(Math.random() * messages.length)];

    this.setActivity({
      name: "Visual Studio Code",
      details: message,
      state: this.workspace ? `Workspace: ${this.workspace}` : "No Workspace",
      assets: {
        large_image: "claude-code",
        large_text: "Claude Code for VS Code",
        large_url:
          "https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code",
        small_image: "clawd",
        small_text: assetText(sessionName),
      },
      timestamps: {
        start: this.startedAt,
      },
    });
  }
}
