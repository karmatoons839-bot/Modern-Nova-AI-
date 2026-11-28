import { describe, it as test } from "node:test";
import { strict as assert } from "node:assert";
import { isTelegramOwner, telegramConfigurationSchema } from "./telegram-config";

const config = { owner_telegram_id: "123456789", admin_chat_id: "-1001234567890", support_chat_id: "-1009876543210" };
const expect = (actual: boolean) => ({ toBe: (expected: boolean) => assert.equal(actual, expected) });
describe("Telegram configuration and identity rules", () => {
  test("accepts the owner's supplied numeric IDs", () => { expect(telegramConfigurationSchema.safeParse({ owner_telegram_id: "8955719524", admin_chat_id: "-1004409130053", support_chat_id: "-1003985328488" }).success).toBe(true); });
  test("only supplied owner can administer supplied private group", () => { expect(isTelegramOwner("8955719524", "-1004409130053", { owner_telegram_id: "8955719524", admin_chat_id: "-1004409130053", support_chat_id: "-1003985328488" })).toBe(true); });
  test("accepts numeric owner and separate numeric groups", () => { expect(telegramConfigurationSchema.safeParse(config).success).toBe(true); });
  test("rejects usernames as owner identity", () => { expect(telegramConfigurationSchema.safeParse({ ...config, owner_telegram_id: "@owner" }).success).toBe(false); });
  test("rejects shared support and admin chat", () => { expect(telegramConfigurationSchema.safeParse({ ...config, support_chat_id: config.admin_chat_id }).success).toBe(false); });
  test("rejects unsafe numeric IDs", () => { expect(telegramConfigurationSchema.safeParse({ ...config, owner_telegram_id: "9999999999999999" }).success).toBe(false); });
  test("owner can use allowlisted admin chat", () => { expect(isTelegramOwner("123456789", "-1001234567890", config)).toBe(true); });
  test("non-owner cannot use allowlisted admin chat", () => { expect(isTelegramOwner("123456788", "-1001234567890", config)).toBe(false); });
  test("support group is not an administrative context", () => { expect(isTelegramOwner("123456789", "-1009876543210", config)).toBe(false); });
  test("forwarded messages never authorize administrative input", () => { expect(isTelegramOwner("123456789", "-1001234567890", config, true)).toBe(false); });
});