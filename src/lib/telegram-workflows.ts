import { z } from "zod";

export const telegramOfferSchema = z.object({
  user_id: z.string().uuid(), name: z.string().trim().min(3).max(80),
  amount_paise: z.number().int().min(100).max(10000000), credits: z.number().int().min(1).max(1000000),
  days: z.number().int().min(1).max(365), tier: z.enum(["creator", "pro", "premium"]), reason: z.string().trim().min(5).max(300),
});

export function recoveryAllowed(linkUser: string | undefined, generation: { user_id: string; status: string; output_path: string | null }): boolean {
  return Boolean(linkUser && generation.user_id === linkUser && generation.status === "done" && generation.output_path?.startsWith(`${linkUser}/`) && !generation.output_path.split("/").includes(".."));
}

/** Bounded interpretation; no arbitrary commands and no inferred financial effects. */
export function telegramIntent(text: string): "files" | "account" | "payments" | "recovery" | "offer" | null {
  const value = text.toLowerCase();
  if (/custom.*plan|custom.*offer|कस्टम.*प्लान/.test(value)) return "offer";
  if (/(audio|file|voice|image|thumbnail|ऑडियो|फाइल).*(missing|lost|not.*find|nahi.*mil|नहीं.*मिल|वापस)|recover|वापस.*(ऑडियो|फाइल)/.test(value)) return "recovery";
  if (/my.*(files|audio|generations)|meri.*(audio|file)|मेरी.*(ऑडियो|फाइल)|^\/files\b/.test(value)) return "files";
  if (/my.*(account|balance|credits|plan)|mera.*(account|balance|plan)|मेरे.*(क्रेडिट|खाते)|^\/account\b/.test(value)) return "account";
  if (/my.*payment|mera.*payment|मेरे.*भुगतान|^\/payments\b/.test(value)) return "payments";
  return null;
}

export function boundedAdminCommand(text: string): string | null {
  const value = text.trim();
  if (value.startsWith("/")) return value;
  const report = value.match(/^(?:report|रिपोर्ट)(?:\s+(1|7|30))?(?:\s+days?)?$/i);
  if (report) return `/report ${report[1] ?? "1"}`;
  if (/^(?:show |list )?tickets$|^टिकट$/i.test(value)) return "/tickets";
  const lookup = value.match(/^(?:find|show|lookup)\s+(user|payment|generation)\s+(\S+)$/i);
  if (lookup) return `/${lookup[1]?.toLowerCase()} ${lookup[2]}`;
  const credits = value.match(/^(add|remove|deduct)\s+(\d+)\s+credits\s+(?:to|from)\s+([0-9a-f-]{36})\s+(?:reason[: ]+)\s*(.{5,300})$/i);
  if (credits) return `/${credits[1]?.toLowerCase() === "add" ? "addcredits" : "deductcredits"} ${credits[3]} ${credits[2]} ${credits[4]}`;
  const status = value.match(/^(suspend|unsuspend)\s+([0-9a-f-]{36})\s+reason[: ]+(.{5,300})$/i);
  if (status) return `/${status[1]?.toLowerCase()} ${status[2]} ${status[3]}`;
  return null;
}