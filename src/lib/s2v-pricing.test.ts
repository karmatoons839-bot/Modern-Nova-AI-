import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { s2vBreakdown } from "./s2v-pricing";

describe("Script to Video pricing", () => {
  it("5 scenes × 5s = 1,500 + 5,000 + 100 = 6,600", () => {
    assert.deepEqual(s2vBreakdown(5, 5), { analysis: 0, images: 1125, animation: 3750, render: 75, total: 4950 });
  });
  it("10s clips cost 1,500 each", () => assert.equal(s2vBreakdown(5, 10).animation, 7500));
  it("1 minute of 5s clips = 9,000 animation", () => assert.equal(s2vBreakdown(12, 5).animation, 9000));
  it("20 minutes of 5s clips = 1,80,000 animation", () => assert.equal(s2vBreakdown(240, 5).animation, 180000));
  it("10 minutes total = 1,17,075", () => assert.equal(s2vBreakdown(120, 5).total, 117075));
  it("follows changed admin prices", () => assert.equal(s2vBreakdown(2, 5, { sceneImage: 1, anim5: 2, anim10: 3, render: 4 }).total, 10));
});
