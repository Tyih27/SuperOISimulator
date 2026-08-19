import assert from "node:assert/strict";
import { FormationController } from "../app/formation.js";

const controller = new FormationController(["planner", "graphist", "structurer", "mathematician"]);

controller.toggle("mathematician");
assert.deepEqual(controller.selectedIds, ["planner", "graphist", "structurer"]);
assert.equal(controller.error, "每场只能选择 3 名学生");

controller.replace("planner", "mathematician");
assert.deepEqual(controller.positions, {
  A1: "mathematician",
  A2: "graphist",
  A3: "structurer",
});

assert.equal(controller.toggle("graphist"), true);
assert.deepEqual(controller.selectedIds, ["mathematician", "structurer"]);
assert.equal(controller.isValid, false);

assert.equal(controller.toggle("planner"), true);
assert.deepEqual(controller.positions, {
  A1: "mathematician",
  A2: "planner",
  A3: "structurer",
});
assert.equal(controller.isValid, true);

assert.throws(() => controller.toggle("unknown"), /Unknown student/);
assert.equal(controller.replace("mathematician", "planner"), false, "a student cannot occupy two slots");

console.log("formation controller tests passed");
