import captureData from "@/data/telegram-captures.json";
import { KNOWLEDGE_VERSION, publicKnowledgeEntry, WEBSITE_KNOWLEDGE } from "./telegram-knowledge";
import { queueTelegram } from "./telegram-delivery.server";
import { approvedPublicCapture } from "./telegram-knowledge-policy";
import { createHash } from "crypto";

const captures: { knowledgeVersion: string; capturedAt: string | null; pages: { id: string; path: string; sourceUrl: string; status: string; assetPath: string | null; capturedAt: string; sha256?: string }[]; review: { id: string; reason: string }[]; history: unknown[] } = captureData;

export function knowledgeReviewStatus() {
  return { version: KNOWLEDGE_VERSION, captured_at: captures.capturedAt, current: WEBSITE_KNOWLEDGE.filter(e => e.lifecycle === "current").map(e => ({ id: e.id, name: e.name, access: e.access })), discontinued: WEBSITE_KNOWLEDGE.filter(e => e.lifecycle === "discontinued").map(e => e.name), archived_versions: captures.history.length, review: captures.review, screenshots: captures.pages.map(p => ({ id: p.id, status: approvedPublicCapture(p, captures.knowledgeVersion, KNOWLEDGE_VERSION) ? "available" : "review", captured_at: p.capturedAt })) };
}

export async function sendKnowledgeScreenshot(id: string, chatId: string, updateId: number) {
  const entry = publicKnowledgeEntry(id);
  const capture = captures.pages.find(p => p.id === id);
  if (!entry || !capture || !approvedPublicCapture(capture, captures.knowledgeVersion, KNOWLEDGE_VERSION)) return false;
  // Immutable project asset plus recorded byte digest, not AI-selected files or payment evidence.
  if (!capture.sha256 || !/^[a-f0-9]{64}$/.test(capture.sha256)) return false;
  const response = await fetch(`https://modernnova.in${capture.assetPath}`, { redirect: "error", signal: AbortSignal.timeout(12000) });
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/jpeg")) throw new Error("PUBLIC_CAPTURE_UNAVAILABLE");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 5 * 1024 * 1024 || createHash("sha256").update(new Uint8Array(bytes)).digest("hex") !== capture.sha256) throw new Error("PUBLIC_CAPTURE_DIGEST_MISMATCH");
  await queueTelegram(`knowledge:${updateId}:${id}`, chatId, `${entry.name} · actual signed-out website page\n${capture.sourceUrl}\nCaptured ${capture.capturedAt}. Layout may change; this is not evidence of a completed generation.`, { update_id: updateId, delivery_method: "sendPhoto", payload: { photo: `https://modernnova.in${capture.assetPath}` } });
  return true;
}