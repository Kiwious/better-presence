import * as assert from "assert";
import { ProjectClock } from "../project-clock";

suite("project clock", () => {
  test("pauses on another project and goes on on return", () => {
    const clock = new ProjectClock();
    assert.strictEqual(clock.start("a", 100), 100);
    assert.strictEqual(clock.start("a", 150), 100);
    assert.strictEqual(clock.start("b", 160), 160);
    // a ran 60, so on return at 300 it shows 60 already passed
    assert.strictEqual(clock.start("a", 300), 240);
  });

  test("stops while no project is open", () => {
    const clock = new ProjectClock();
    clock.start("a", 0);
    assert.strictEqual(clock.start(undefined, 50), undefined);
    assert.strictEqual(clock.start("a", 1000), 950);
  });
});
