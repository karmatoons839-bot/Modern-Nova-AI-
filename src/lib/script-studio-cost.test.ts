import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
vi.mock("./maintenance.server", () => ({ requireGenerationAvailable: async () => {} }));
import { scriptStudioCost } from "./credits.server";
describe("Script Studio price", () => {
  it("500 for first minute, +200 per extra minute", () => {
    expect(scriptStudioCost(1)).toBe(500);
    expect(scriptStudioCost(10)).toBe(2300);
    expect(scriptStudioCost(30)).toBe(6300);
  });
});
