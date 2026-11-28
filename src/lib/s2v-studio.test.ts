import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { studioQuote, studioSchema, taskKey, clipProgress } from "./s2v-studio";
const base = { backgrounds: 5, characters: 0, frames: 0, clips: 5, clipSeconds: 5 as const, voiceOn: false, voiceSeconds: 0, render: true };
describe("Dedicated studio rules", () => {
  it("5 images (375) + 5 animations (750) + render (75) = 5700", () => assert.equal(studioQuote(base).total, 5700));
  it("character reference costs 225", () => assert.equal(studioQuote({ ...base, characters: 1 }).characters, 225));
  it("voice costs 375 for one minute", () => assert.equal(studioQuote({ ...base, voiceOn: true, voiceSeconds: 60 }).voice, 375));
  it("voice OFF costs zero even with duration", () => assert.equal(studioQuote({ ...base, voiceSeconds: 600 }).voice, 0));
  it("10-second animation costs 1500 per clip", () => assert.equal(studioQuote({ ...base, clipSeconds: 10 }).animation, 7500));
  it("20-minute animation-only charge is 180000", () => assert.equal(studioQuote({ ...base, clips: 240 }).animation, 180000));
  it("no new assets means no image charge", () => assert.equal(studioQuote({ ...base, backgrounds: 0 }).backgrounds, 0));
  it("render is not charged without an actual render task", () => assert.equal(studioQuote({ ...base, render: false }).render, 0));
  it("operation key is stable for duplicate confirmations", () => { const d = studioSchema.parse({}); assert.equal(taskKey(d,"background",0),taskKey(d,"background",0)); assert.notEqual(taskKey(d,"background",0),taskKey(d,"background",0,1)); });
  it("progress uses actual completed clips", () => assert.deepEqual(clipProgress([{kind:"animation",status:"completed"},{kind:"animation",status:"remote"}],5),{total:5,completed:1,remaining:4,percent:20}));
});