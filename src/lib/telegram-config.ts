import { z } from "zod";

export const telegramConfigurationSchema = z.object({
  owner_telegram_id: z.string().trim().regex(/^[1-9][0-9]{0,15}$/, "Enter a positive numeric Telegram user ID"),
  admin_chat_id: z.string().trim().regex(/^-[1-9][0-9]{0,15}$/, "Enter a negative numeric group chat ID"),
  support_chat_id: z.string().trim().regex(/^-[1-9][0-9]{0,15}$/, "Enter a negative numeric group chat ID"),
}).superRefine((value, ctx) => {
  if (value.admin_chat_id === value.support_chat_id) ctx.addIssue({ code: "custom", path: ["support_chat_id"], message: "Use separate admin and support groups" });
  for (const [key, id] of Object.entries(value)) {
    if (!Number.isSafeInteger(Number(id))) ctx.addIssue({ code: "custom", path: [key], message: "Telegram ID is outside the supported numeric range" });
  }
});

export type TelegramConfiguration = z.infer<typeof telegramConfigurationSchema>;
export type TelegramCheck = { name: string; status: "passed" | "failed" | "pending"; message: string };
export type TelegramHealth = { checked_at: string; checks: TelegramCheck[]; bot_username: string | null };

/** Only unforwarded messages from the configured sender and explicit chat are administrative input. */
export function isTelegramOwner(sender: string, chat: string, config: TelegramConfiguration, forwarded = false) {
  return !forwarded && sender === config.owner_telegram_id && (chat === config.admin_chat_id || chat === config.owner_telegram_id);
}