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

  test("never reveals a command", () => {
    const action = lastAction(step(tool("Bash", { command: "curl -H secret" })));
    assert.strictEqual(action, "Running a command");
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
