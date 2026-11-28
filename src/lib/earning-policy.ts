export const DEFAULT_EARNING_REWARDS = { ad: 1000, member: 1000 } as const;
export function isDirectNewMember(oldStatus: string, newStatus: string, inviter: string, member: string, bot: boolean) {
  return oldStatus === "left" && ["member", "administrator"].includes(newStatus) && inviter !== member && !bot;
}
export function activePaidAdExemption(plan: string, status: string, expires: string | null, now = Date.now()) {
  return ["creator", "pro", "premium"].includes(plan) && status === "active" && expires !== null && Date.parse(expires) > now;
}