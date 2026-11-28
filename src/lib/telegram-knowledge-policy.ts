import { publicKnowledgeEntry } from "./telegram-knowledge";

export function approvedPublicCapture(capture: { id: string; path: string; sourceUrl: string; status: string; assetPath: string | null; capturedAt: string }, recordedVersion: string, currentVersion: string, now = Date.now()) {
  const entry = publicKnowledgeEntry(capture.id);
  const time = Date.parse(capture.capturedAt);
  return Boolean(entry && entry.path === capture.path && capture.sourceUrl === `https://modernnova.in${entry.path}` && capture.status === "captured" && recordedVersion === currentVersion && capture.assetPath && /^\/__l5e\/assets-v1\/[0-9a-f-]{36}\/telegram-help-[a-z]+\.jpg$/.test(capture.assetPath) && Number.isFinite(time) && time <= now && now - time <= 14 * 86400000);
}