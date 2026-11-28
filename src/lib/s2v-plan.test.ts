import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { studioSchema, STUDIO_RATES } from "./s2v-studio";
import { planVideo } from "./s2v-timing";
const d = studioSchema.parse({ locations: [{ name: "a", description: "" }], characters: [{ name: "c", description: "" }], scenes: [{ title: "1", description: "", location: 0, characters: [0], lines: [{ speaker: "c", text: "one two three" }] }] });
describe("Script to Video plan", () => {
  it("voice OFF adds no voice credits", () => assert.equal(planVideo({ ...d, voiceOn: false }, STUDIO_RATES).cost.voice, 0));
  it("voice ON charges the existing per-scene voice rate", () => assert.equal(planVideo({ ...d, voiceOn: true }, STUDIO_RATES).cost.voice, 32));
  it("background 375 + character 225 + scene image 375 + 5s clip 750 + render 75", () => assert.equal(planVideo(d, STUDIO_RATES).cost.total, 1800));
  it("long voice adds new moving clips instead of stretching one", () => {
    const long = { ...d, voiceOn: true, scenes: [{ ...d.scenes[0]!, lines: [{ speaker: "c", text: Array(30).fill("word").join(" "), emotion: "Calm" as const }] }] };
    const p = planVideo(long, STUDIO_RATES); assert.equal(p.clips, 2); assert.equal(p.cost.animation, 750 + 1500);
  });
  it("already generated assets are not charged again", () => assert.equal(planVideo(d, STUDIO_RATES, { backgrounds: 1, characters: 1, frames: 1, clips: 1, voices: 0 }).cost.total, 75));
});
