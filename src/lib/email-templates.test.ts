import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import * as React from "react";
import { render } from "@react-email/render";
import { TEMPLATES } from "./email-templates/registry";

describe("email templates", () => {
  it("registers all four notification templates", () => {
    for (const name of ["welcome", "payment-receipt", "generation-ready", "support-ticket"]) {
      assert.ok(TEMPLATES[name], `missing template ${name}`);
    }
  });
  it("renders every template with its preview data and a real subject", async () => {
    for (const [name, entry] of Object.entries(TEMPLATES)) {
      assert.ok(entry.previewData, `${name} needs previewData`);
      const html = await render(React.createElement(entry.component, entry.previewData));
      assert.ok(html.includes("Modern Nova AI"), `${name} must carry the brand name`);
      const subject = typeof entry.subject === "function" ? entry.subject(entry.previewData!) : entry.subject;
      assert.ok(subject.length > 5, `${name} subject too short`);
    }
  });
  it("never ships promotional content in transactional templates", async () => {
    for (const [name, entry] of Object.entries(TEMPLATES)) {
      const html = await render(React.createElement(entry.component, entry.previewData ?? {}));
      assert.equal(/offer|sale|discount|buy now|limited time/i.test(html), false, `${name} looks promotional`);
    }
  });
});
