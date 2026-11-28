import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { additionalSegments, continuationKey, continuationTarget, requireMovingCoverage } from "./s2v-timing";
import { studioSchema, STUDIO_RATES } from "./s2v-studio";
describe("Full voice requires real moving video", () => {
  it("14s voice over 10s video needs a new supported 5s clip costing 750", () => assert.deepEqual(additionalSegments(10,14,STUDIO_RATES),[{seconds:5,cost:750}]));
  it("14s voice over 5s video needs a new 10s clip costing 1500", () => assert.deepEqual(additionalSegments(5,14,STUDIO_RATES),[{seconds:10,cost:1500}]));
  it("rejects 5s video with 14s voice instead of holding frames", () => assert.throws(()=>requireMovingCoverage(5,14,0),/Generate additional video/));
  it("accepts 15s moving video with all 14s voice", () => assert.doesNotThrow(()=>requireMovingCoverage(15,14,0)));
  it("silent and shorter voices never need generation", () => {assert.deepEqual(additionalSegments(10,0,STUDIO_RATES),[]);assert.deepEqual(additionalSegments(10,7,STUDIO_RATES),[]);});
  it("completed coverage is reused without extra clips", () => assert.deepEqual(additionalSegments(15,14.6,STUDIO_RATES),[]));
  it("duplicate continuation keys are stable and changed sources invalidate them", () => {const d=studioSchema.parse({});assert.equal(continuationKey(d,0,1,"c","v"),continuationKey(d,0,1,"c","v"));assert.notEqual(continuationKey(d,0,1,"c","v"),continuationKey(d,0,1,"new","v"));assert.notEqual(continuationTarget(0,1),continuationTarget(1,1));});
  it("unknown duration fails closed", () => assert.throws(()=>additionalSegments(NaN,14,STUDIO_RATES)));
});