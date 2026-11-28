import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { maintenanceBlocks, isServiceIssue } from "./maintenance-policy";
describe("maintenance access", () => {
  it("blocks ordinary accounts while maintenance is enabled", () => assert.equal(maintenanceBlocks(true, false), true));
  it("allows owner admin to generate during maintenance", () => assert.equal(maintenanceBlocks(true, true), false));
  it("restores ordinary access when owner disables maintenance", () => assert.equal(maintenanceBlocks(false, false), false));
  it("classifies provider payment-required as server issue", () => assert.equal(isServiceIssue(402), true));
  it("does not classify valid generation as server issue", () => assert.equal(isServiceIssue(200), false));
});