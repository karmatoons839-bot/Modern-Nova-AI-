import horrorSpec from "@/data/story-engines/horror-engine.md?raw";
import moralSpec from "@/data/story-engines/moral-engine.txt?raw";
import { astraText } from "./ai.server";

// Two independent engines. Each runs only its own full specification — never merged, no generic fallback.

const OUTPUT_FORMAT = `OUTPUT FORMAT (mandatory):
Line 1: the story title only.
Then blocks separated by a blank line. Narration blocks: the line "नैरेटर" then the narration on the next line.
Dialogue blocks: the character name alone on its own line, then that character's dialogue directly below.
Never use emotion tags like [sad], [angry], [crying]. No markdown, no headings, no section labels, no notes before or after the story.
Keep dialogue more prominent than narration.`;

export type HorrorInput = { topic: string; description?: string | undefined; language: string; minutes: number };
export type MoralInput = { title: string; description?: string | undefined; language: string; minutes: number };

const lengthHint = (m: number) => `${m} minute${m > 1 ? "s" : ""} of narration when read aloud (about ${m * 140} words)`;

export async function runHorrorEngine(i: HorrorInput) {
  const instructions = `You are the Horror Story Engine. Follow this complete specification exactly:\n\n${horrorSpec}\n\n${OUTPUT_FORMAT}\nUse the given TITLE exactly as line 1. Keep horror YouTube-safe: atmosphere, sounds, shadows, implied non-graphic violence, no gore.`;
  const input = `TITLE / TOPIC: ${i.topic}\nSCRIPT BRIEF: ${i.description || "Develop the title into an original script."}\nLANGUAGE: ${i.language}. Write all narration and dialogue in this language, in its native script; use its natural regional vocabulary. The language choice overrides any default language in the specification.\nSTORY LENGTH: ${lengthHint(i.minutes)}. Respect this duration closely.\nWrite a completely original story.`;
  return astraText(instructions, input);
}

export async function runMoralEngine(i: MoralInput) {
  const instructions = `You are the Model Story Engine. Follow this complete specification exactly:\n\n${moralSpec}\n\n${OUTPUT_FORMAT}\nUse the user's Title exactly as line 1. Invent the hook, twist and moral yourself.`;
  const input = `TITLE: ${i.title}
LANGUAGE: ${i.language}
Write all narration and dialogue in ${i.language}, in its native script, using natural regional vocabulary. This overrides any default language in the specification.
SCRIPT BRIEF: ${i.description || "Develop the title into an original script."}
STORY LENGTH: ${lengthHint(i.minutes)}. Respect this duration closely.
Create your own strong 10-second hook, a surprising twist and a clear moral that fit this title. Natural conversational style. Write a completely original story.`;
  return astraText(instructions, input);
}

export function cleanStory(raw: string) {
  return raw.replace(/```[a-z]*\n?/g, "").replace(/\[(?:[a-zA-Z\u0900-\u097F ]{2,20})\]/g, "").trim();
}
