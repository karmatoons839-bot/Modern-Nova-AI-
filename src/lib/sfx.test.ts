import { describe, expect, it } from "vitest";
import { sfxCost, applyEdits, mixTimeline, sfxRequestSchema, DEFAULT_EDIT } from "./sfx";

describe("sfx", () => {
  it("charges 200 credits per started second (5s = 1000)", () => { expect(sfxCost(1)).toBe(200); expect(sfxCost(5)).toBe(1000); expect(sfxCost(2.5)).toBe(600); });
  it("rejects durations above 22 seconds and extra fields", () => {
    expect(sfxRequestSchema.safeParse({ prompt: "door creak", duration: 23 }).success).toBe(false);
    expect(sfxRequestSchema.safeParse({ prompt: "door creak", duration: 3, cost: 0 }).success).toBe(false);
  });
  it("speed 2x halves length, duration control sets exact length", () => {
    const src = new Float32Array(48000).map((_, i) => Math.sin(i / 10) * 0.5);
    expect(Math.abs(applyEdits(src, 48000, { ...DEFAULT_EDIT, speed: 2 }).length - 24000)).toBeLessThan(10);
    expect(applyEdits(src, 48000, { ...DEFAULT_EDIT, duration: 3 }).length).toBe(144000);
  });
  it("timeline places clips at their start time", () => {
    const out = mixTimeline([{ id: "a", data: new Float32Array(10).fill(0.5), start: 1, gain: 1 }], 100);
    expect(out.length).toBe(110);
    expect(out[99]).toBe(0);
    expect(out[100]).toBe(0.5);
  });
});
