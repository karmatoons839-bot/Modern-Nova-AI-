import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { emailPreferenceAllows } from "./email-preferences";

describe("email preferences", () => {
  it("defaults allow every category when toggles were never set", () => {
    for (const c of ["account", "generation", "payment"] as const) {
      assert.equal(emailPreferenceAllows({}, c), true);
    }
  });
  it("the master email switch blocks every category", () => {
    for (const c of ["account", "generation", "payment"] as const) {
      assert.equal(emailPreferenceAllows({ notify_email: false }, c), false);
    }
  });
  it("generation toggle blocks only generation emails", () => {
    const prefs = { notify_generation: false };
    assert.equal(emailPreferenceAllows(prefs, "generation"), false);
    assert.equal(emailPreferenceAllows(prefs, "payment"), true);
    assert.equal(emailPreferenceAllows(prefs, "account"), true);
  });
  it("payment toggle blocks only payment emails", () => {
    const prefs = { notify_payment: false };
    assert.equal(emailPreferenceAllows(prefs, "payment"), false);
    assert.equal(emailPreferenceAllows(prefs, "generation"), true);
    assert.equal(emailPreferenceAllows(prefs, "account"), true);
  });
  it("explicit true values keep every category enabled", () => {
    const prefs = { notify_email: true, notify_generation: true, notify_payment: true };
    for (const c of ["account", "generation", "payment"] as const) {
      assert.equal(emailPreferenceAllows(prefs, c), true);
    }
  });
});
