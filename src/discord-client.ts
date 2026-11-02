import { Client } from "@nxenjs/discord-rich-presence";
import { window, type Tab, type TextEditor } from "vscode";
import { messages } from "./messages";

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

  public constructor({ clientId, window, workspace }: Settings) {
    super();
    this.window = window;
    this.workspace = workspace;
    this.tabs = [];

    this.once("ready", () => {
      this.window.showInformationMessage("Discord connected");
      this.update();
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

    if (this.startedAt === undefined) {
      this.startedAt = Date.now();
    }

    const tab = this.window.tabGroups.activeTabGroup.activeTab;

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

    if (tab.label === "Claude Code") {
      this.setClaudeCodeActivity();
      this.interval = setInterval(() => {
        this.setClaudeCodeActivity();
      }, 15_000);
    } else {
      this.setActivity({
        name: "Visual Studio Code",
        details: `Editing ${tab.label}`,
        state: this.workspace ? `Workspace ${this.workspace}` : "No Workspace",
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
      this.window.showInformationMessage(group.activeTab.label);
    }
  }

  public onDidChangeActiveTextEditor(e: TextEditor | undefined) {
    this.update();
  }

  private setClaudeCodeActivity() {
    const message = messages[Math.floor(Math.random() * messages.length)];

    this.setActivity({
      name: "Visual Studio Code",
      details: message,
      state: this.workspace ? `Workspace ${this.workspace}` : "No Workspace",
      assets: {
        large_image:
          "https://cdn.aptoide.com/imgs/7/9/5/7959868d3cc002019cf3a1507ee3d476_icon.png",
        large_text: "Claude Code for VS Code",
        large_url:
          "https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code",
      },
      timestamps: {
        start: this.startedAt,
      },
    });
  }
}
