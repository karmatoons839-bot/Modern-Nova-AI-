import { taskKey, type StudioData } from "./s2v-studio";

/** Same ordered source media always means the same billable render. */
export async function renderOperationKey(d: StudioData, clips: (string | string[])[], voices: (string | null)[]) {
  const bytes = new TextEncoder().encode(JSON.stringify({ clips, voices }));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const fingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  return `${taskKey(d, "render", 0)}:${fingerprint}`;
}

export function ownedImagePath(userId: string, path: string) {
  return path.startsWith(`${userId}/`) && !path.includes("..") && /\.(jpg|jpeg|png|webp)$/i.test(path);
}