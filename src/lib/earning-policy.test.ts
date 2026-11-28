import { describe, it, expect } from "vitest";
import { DEFAULT_EARNING_REWARDS, isDirectNewMember, activePaidAdExemption } from "./earning-policy";
describe("verified earning rules", () => {
  it("defaults completed ads to 1000 credits", () => expect(DEFAULT_EARNING_REWARDS.ad).toBe(1000));
  it("defaults genuine members to 1000 credits", () => expect(DEFAULT_EARNING_REWARDS.member).toBe(1000));
  it("accepts a direct left-to-member human transition", () => expect(isDirectNewMember("left", "member", "1", "2", false)).toBe(true));
  it("does not reward existing members", () => expect(isDirectNewMember("member", "member", "1", "2", false)).toBe(false));
  it("does not reward bots", () => expect(isDirectNewMember("left", "member", "1", "2", true)).toBe(false));
  it("does not reward self joins", () => expect(isDirectNewMember("left", "member", "2", "2", false)).toBe(false));
  it("active paid plans are ad free", () => expect(activePaidAdExemption("creator", "active", "2026-12-01", Date.parse("2026-11-15"))).toBe(true));
  it("expired Premium is not ad free", () => expect(activePaidAdExemption("premium", "active", "2026-11-14", Date.parse("2026-11-15"))).toBe(false));
  it("free is not ad free", () => expect(activePaidAdExemption("free", "active", "2026-12-01", Date.parse("2026-11-15"))).toBe(false));
});