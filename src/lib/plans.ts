export type PlanId = "free" | "creator" | "pro" | "premium";
export type PaidPlanId = Exclude<PlanId, "free">;
export const PAID_PLAN_IDS = ["creator", "pro", "premium"] as const;

export const PLANS: {
  id: PlanId;
  name: string;
  priceInr: number;
  credits: number;
  voices: number;
  features: string[];
}[] = [
  {
    id: "free",
    name: "Free",
    priceInr: 0,
    credits: 5000,
    voices: 50,
    features: ["5,000 credits", "50 AI voices", "Free voice previews", "Core AI tools access", "WAV download"],
  },
  {
    id: "creator",
    name: "Basic",
    priceInr: 199,
    credits: 50000,
    voices: 150,
    features: ["50,000 credits / month", "150 AI voices", "HD image generation", "HD thumbnail generation", "MP3 / WAV voice download"],
  },
  {
    id: "pro",
    name: "Standard",
    priceInr: 499,
    credits: 100000,
    voices: 250,
    features: ["100,000 credits / month", "250 AI voices", "HD image generation", "HD thumbnail generation", "MP3 / WAV voice download"],
  },
  {
    id: "premium",
    name: "Premium",
    priceInr: 999,
    credits: 500000,
    voices: 400,
    features: ["500,000 credits / month", "All 400 AI voices", "Highest-quality generation", "Priority generation", "MP3 / WAV download", "Premium voice & image options"],
  },
];

export const COST_LABELS = { voice: "1,000 credits / minute", image: "1,500 credits / image", thumbnail: "2,000 credits / thumbnail", video: "1,000 credits / second", preview: "Free" };

/** Spread each plan's voices across genders: free = 1 of every 8, creator = 3, pro = 5, premium = all. */
export function voiceAllowed(voiceId: string, plan: PlanId) {
  if (plan === "premium") return true;
  const r = Number(voiceId.replace(/\D/g, "")) % 8;
  if (plan === "pro") return [1, 3, 4, 6, 7].includes(r);
  if (plan === "creator") return r === 1 || r === 4 || r === 6;
  return r === 1;
}
