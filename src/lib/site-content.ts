import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ContentField = { key: string; label: string; group: string; kind: "text" | "long" | "image"; def: string };

/** Every piece of site text/image the admin can edit. Defaults are the current live copy. */
export const CONTENT_FIELDS: ContentField[] = [
  { group: "Header", key: "header.logo", label: "Logo image", kind: "image", def: "" },
  { group: "Header", key: "header.brand", label: "Brand name", kind: "text", def: "" },
  { group: "Header", key: "header.tagline", label: "Tagline", kind: "text", def: "" },

  { group: "Home — Top", key: "home.badge", label: "Small badge", kind: "text", def: "Modern Nova AI" },
  { group: "Home — Top", key: "home.title", label: "Main heading", kind: "long", def: "Tell your story. We give it a voice, a picture and a thumbnail." },
  { group: "Home — Top", key: "home.subtitle", label: "Sub heading", kind: "long", def: "One studio for creators — multi-character voice-overs, story artwork and click-worthy YouTube thumbnails." },
  { group: "Home — Top", key: "home.cta", label: "Button text", kind: "text", def: "EXPLORE TOOL" },
  { group: "Home — Top", key: "home.hero_image", label: "Top image (optional)", kind: "image", def: "" },

  { group: "Home — About", key: "home.about_title", label: "Heading", kind: "text", def: "What is Modern Nova AI?" },
  { group: "Home — About", key: "home.about_text", label: "Text", kind: "long", def: "Modern Nova AI is an AI creative platform that brings story writing, voice-overs, images and thumbnails together in one place. It is made for YouTubers, storytellers, Shorts and Reels creators, teachers and anyone who wants to turn an idea into finished creative content without switching between many apps. The site works in English and Hinglish." },

  { group: "Home — Tools", key: "home.tools_title", label: "Heading", kind: "text", def: "AI Creative Tools" },
  { group: "Home — Tools", key: "home.tools_text", label: "Text", kind: "long", def: "Every tool generates new content with AI — nothing is pre-made. Use them on their own or together: write a story, voice it, then create artwork and a thumbnail for the video." },
  { group: "Home — Tools", key: "home.f1_title", label: "Card 1 title", kind: "text", def: "Script Studio" },
  { group: "Home — Tools", key: "home.f1_text", label: "Card 1 text", kind: "long", def: "Give your script a title and brief, choose a language, type and duration, then create an original script ready for Voice Studio." },
  { group: "Home — Tools", key: "home.f2_title", label: "Card 2 title", kind: "text", def: "Voice Studio" },
  { group: "Home — Tools", key: "home.f2_text", label: "Card 2 text", kind: "long", def: "Paste a story and the AI voice generator detects each character, lets you lock one emotion per line and voices every role from a library of 400 voice profiles filtered by age, gender and style. Download the result as MP3 or WAV." },
  { group: "Home — Tools", key: "home.f3_title", label: "Card 3 title", kind: "text", def: "AI Image Generator" },
  { group: "Home — Tools", key: "home.f3_text", label: "Card 3 text", kind: "long", def: "Describe a scene and the AI image generator creates artwork in styles such as 2D, 3D, realistic, horror, anime and cartoon, in 1:1, 9:16 or 16:9 sizes." },
  { group: "Home — Tools", key: "home.f4_title", label: "Card 4 title", kind: "text", def: "AI Thumbnail Generator" },
  { group: "Home — Tools", key: "home.f4_text", label: "Card 4 text", kind: "long", def: "Turn a video idea into a high-contrast thumbnail. The AI thumbnail generator supports YouTube 16:9, Shorts 9:16 and square formats, with optional title text printed on the image." },

  { group: "Home — Steps", key: "home.steps_title", label: "Heading", kind: "text", def: "How Modern Nova AI works" },
  { group: "Home — Steps", key: "home.s1_title", label: "Step 1 title", kind: "text", def: "Sign in" },
  { group: "Home — Steps", key: "home.s1_text", label: "Step 1 text", kind: "long", def: "Create a free account with Google or email. New accounts start with free credits." },
  { group: "Home — Steps", key: "home.s2_title", label: "Step 2 title", kind: "text", def: "Pick a tool" },
  { group: "Home — Steps", key: "home.s2_text", label: "Step 2 text", kind: "long", def: "Choose the story, voice, image or thumbnail tool and enter your idea." },
  { group: "Home — Steps", key: "home.s3_title", label: "Step 3 title", kind: "text", def: "Generate and download" },
  { group: "Home — Steps", key: "home.s3_text", label: "Step 3 text", kind: "long", def: "The AI creates your content. Finished work is saved in your History to download anytime." },

  { group: "Tools page", key: "tools.title", label: "Heading", kind: "text", def: "Choose a tool" },
  { group: "Tools page", key: "tools.subtitle", label: "Sub heading", kind: "text", def: "Everything runs on real AI — nothing is pre-made." },
  { group: "Tools page", key: "tools.t1_title", label: "Story card title", kind: "text", def: "Script Studio" },
  { group: "Tools page", key: "tools.t1_text", label: "Story card text", kind: "long", def: "Original horror and moral scripts, with your brief, language and duration." },
  { group: "Tools page", key: "tools.t2_title", label: "Voice card title", kind: "text", def: "Voice Studio" },
  { group: "Tools page", key: "tools.t2_text", label: "Voice card text", kind: "long", def: "Analyze a story, lock emotions per line and voice every character from 400 profiles." },
  { group: "Tools page", key: "tools.t3_title", label: "Image card title", kind: "text", def: "Image Generate" },
  { group: "Tools page", key: "tools.t3_text", label: "Image card text", kind: "long", def: "Prompt to artwork in 2D, 3D, realistic, horror, anime, cartoon and more." },
  { group: "Tools page", key: "tools.t4_title", label: "Thumbnail card title", kind: "text", def: "Thumbnail Generate" },
  { group: "Tools page", key: "tools.t4_text", label: "Thumbnail card text", kind: "long", def: "Turn a video or story idea into a high-contrast YouTube thumbnail." },
  { group: "Tools page", key: "tools.t6_title", label: "Script to Video card title", kind: "text", def: "Script to Video" },
  { group: "Tools page", key: "tools.t6_text", label: "Script to Video card text", kind: "long", def: "Turn your script into a full story video — scenes, characters, voiceover and one final MP4." },
];

export const CONTENT_KEYS = new Set(CONTENT_FIELDS.map((f) => f.key));
const DEFAULTS = Object.fromEntries(CONTENT_FIELDS.map((f) => [f.key, f.def]));

export const SITE_CONTENT_QK = ["site-content"] as const;

export function useSiteContentMap() {
  return useQuery({
    queryKey: SITE_CONTENT_QK,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("site_content").select("key, value");
      return Object.fromEntries((data ?? []).map((r) => [r.key, r.value])) as Record<string, string>;
    },
  });
}

/** Returns a getter: published value if set, else the given fallback, else the registry default. */
export function useSiteContent() {
  const { data } = useSiteContentMap();
  return (key: string, fallback?: string) => {
    const v = data?.[key];
    return v && v.length ? v : fallback ?? DEFAULTS[key] ?? "";
  };
}
