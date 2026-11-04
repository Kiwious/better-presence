import * as assert from "assert";
import { lastAction } from "../app-session";

const step = (...content: object[]) =>
  JSON.stringify({ type: "assistant", message: { content } });
const tool = (name: string, input = {}) => ({ type: "tool_use", name, input });

suite("lastAction", () => {
  test("names the newest step", () => {
    const edit = step(tool("Edit", { file_path: "src/pet.ts" }));
    assert.strictEqual(lastAction(`${step(tool("Bash"))}\n${edit}\n`), "Editing pet.ts");
    assert.strictEqual(lastAction(step({ type: "thinking" })), "Thinking");
    assert.strictEqual(lastAction(step(tool("SomethingNew"))), "Working");
  });

  test("skips the app's task list steps", () => {
    const plan = step(tool("mcp__ccd_turn__update_plan"));
    assert.strictEqual(lastAction(`${step(tool("Bash"))}\n${plan}`), "Running a command");
  });

  test("never reveals a command", () => {
    const action = lastAction(step(tool("Bash", { command: "curl -H secret" })));
    assert.strictEqual(action, "Running a command");
  });

  test("names the kind of a command, without its text", () => {
    const kind = (command: string) => lastAction(step(tool("Bash", { command })));
    assert.strictEqual(kind("yarn test:unit"), "Running the tests");
    assert.strictEqual(kind("cd a && npx mocha x"), "Running the tests");
    assert.strictEqual(kind("yarn vsce package"), "Building");
    assert.strictEqual(kind("git status && git add . && git commit -m 'secret'"), "Committing");
    assert.strictEqual(kind("git -C some/dir push fork main"), "Pushing");
    assert.strictEqual(kind("git log"), "Checking git");
    assert.strictEqual(kind("git pull"), "Syncing with git");
    assert.strictEqual(kind("rm -rf dist"), "Deleting files");
    assert.strictEqual(kind("npm install left-pad"), "Installing packages");
    assert.strictEqual(kind("gh pr view"), "Talking to GitHub");
    assert.strictEqual(kind("echo yarn test"), "Running a command");
  });

  test("names the app's other tools", () => {
    const named = (name: string) => lastAction(step(tool(name)));
    assert.strictEqual(named("AskUserQuestion"), "Asking you something");
    assert.strictEqual(named("mcp__Claude_Browser__navigate"), "Browsing the web");
    assert.strictEqual(named("mcp__ccd_pr__get_status"), "Talking to GitHub");
    assert.strictEqual(named("mcp__ccd_session__start_session"), "Managing sessions");
    assert.strictEqual(named("mcp__kapso__secret_thing"), "Using a connector");
  });

  test("skips subagents, other entries and a cut-off first line", () => {
    const side = JSON.stringify({
      type: "assistant",
      isSidechain: true,
      message: { content: [tool("Read", { file_path: "no.ts" })] },
    });
    const other = JSON.stringify({ type: "user", message: { content: "hi" } });
    const read = step(tool("Read", { file_path: "yes.ts" }));
    assert.strictEqual(lastAction(`{"cut":\n${read}\n${side}\n${other}`), "Reading yes.ts");
    assert.strictEqual(lastAction('{"cut":'), undefined);
  });
});
