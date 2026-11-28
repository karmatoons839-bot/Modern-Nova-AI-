import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { PLANS } from "./plans";

const plan = (id: string) => PLANS.find((p) => p.id === id)!;
describe("subscription plans", () => {
  it("Free ₹0 5,000", () => assert.deepEqual([plan("free").priceInr, plan("free").credits], [0, 5000]));
  it("Basic ₹199 50,000", () => assert.deepEqual([plan("creator").name, plan("creator").priceInr, plan("creator").credits], ["Basic", 199, 50000]));
  it("Standard ₹499 100,000", () => assert.deepEqual([plan("pro").name, plan("pro").priceInr, plan("pro").credits], ["Standard", 499, 100000]));
  it("Premium ₹999 500,000", () => assert.deepEqual([plan("premium").priceInr, plan("premium").credits], [999, 500000]));
  it("exactly four plans", () => assert.equal(PLANS.length, 4));
});
