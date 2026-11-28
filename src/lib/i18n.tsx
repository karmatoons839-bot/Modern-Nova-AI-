import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "en" | "hi";

const STRINGS = {
  characterCount: { en: 'characters', hi: 'characters / अक्षर' },
  storyProcessingLimit: { en: 'Processing limit reached', hi: 'Processing ki seema pahunch gayi' },
  storyImportLimit: { en: 'Import limit reached (2 MB). Your current story is preserved.', hi: 'Import ki seema 2 MB hai. Aapki story surakshit hai.' },
  storyImportFailed: { en: 'Could not read this file. Your current story is preserved.', hi: 'File padh nahi sake. Aapki story surakshit hai.' },
  storySections: { en: 'sections completed', hi: 'hisse poore hue' },
  storyProgress: { en: 'Story processing progress', hi: 'Story processing ki pragati' },
  maintenanceTitle: { en: "Website maintenance", hi: "Website par kaam chal raha hai" },
  maintenanceBody: { en: "We’re working on the website. Please come back later.", hi: "Website par abhi kaam chal raha hai. Kripya baad mein aaiye." },
  maintenanceLogin: { en: "Admin sign in", hi: "Admin login" },
  maintenanceAdminOn: { en: "Maintenance ON · Admin access remains available", hi: "Maintenance ON · Admin ka access chalu hai" },
  maintenanceAdminOff: { en: "Maintenance OFF · Website open to visitors", hi: "Maintenance OFF · Website sabke liye khuli hai" },
  maintenanceRemove: { en: "Remove maintenance", hi: "Maintenance hatao" },
  maintenanceEnable: { en: "Enable maintenance", hi: "Maintenance lagao" },
  maintenanceConfirmOff: { en: "Remove maintenance and reopen the website to everyone?", hi: "Maintenance hatakar website sabke liye khol dein?" },
  maintenanceConfirmOn: { en: "Enable maintenance for everyone except the owner admin?", hi: "Admin ke alawa sabke liye maintenance lagayein?" },
  serverIssue: { en: "Server issue. Please try again later.", hi: "Server issue hai. Kripya baad mein try karein." },
  brand: { en: "Modern Nova AI", hi: "Modern Nova AI" },
  tagline: { en: "All in One", hi: "All in One" },
  navStudio: { en: "Studio", hi: "Studio" },
  navVoices: { en: "Voices", hi: "Awaaz Library" },
  navProjects: { en: "Projects", hi: "Projects" },
  navSettings: { en: "Settings", hi: "Settings" },
  studioTitle: { en: "Voice Studio", hi: "Voice Studio" },
  studioSub: {
    en: "Write a story, detect characters, lock one emotion per line, then generate real voices.",
    hi: "Story likho, character detect karo, har line ka ek emotion lock karo, phir real voice generate karo.",
  },
  projectName: { en: "Project name", hi: "Project ka naam" },
  script: { en: "Story script", hi: "Story script" },
  scriptHint: {
    en: "Optional: start a block with [Character]. AI detects every emotion automatically.",
    hi: "Optional: block se pehle [Character] likho. Emotion AI khud lagata hai.",
  },
  loadSample: { en: "Load sample story", hi: "Sample story load karo" },
  clear: { en: "Clear", hi: "Khaali karo" },
  analyze: { en: "Analyze", hi: "Analyze" },
  analyzing: { en: "Analyzing story...", hi: "Story analyze ho rahi hai..." },
  emotionAdd: { en: "Emotion Add", hi: "Emotion Add" },
  emotionAdding: { en: "Adding emotions...", hi: "Emotion add ho rahe hain..." },
  characters: { en: "Characters", hi: "Characters" },
  noCharacters: {
    en: "Run Analyze to detect the characters in your story.",
    hi: "Characters dekhne ke liye Analyze chalao.",
  },
  assignVoice: { en: "Assign voice", hi: "Voice choose karo" },
  lines: { en: "lines", hi: "lines" },
  words: { en: "words", hi: "shabd" },
  speed: { en: "Speed", hi: "Speed" },
  storyLines: { en: "Story lines", hi: "Story ki lines" },
  emotionLocked: { en: "Emotion locked", hi: "Emotion locked" },
  noEmotion: { en: "No emotion yet", hi: "Abhi emotion nahi" },
  generate: { en: "Generate voice-over", hi: "Voice-over generate karo" },
  generating: { en: "Generating...", hi: "Generate ho raha hai..." },
  play: { en: "Play", hi: "Chalao" },
  pause: { en: "Pause", hi: "Rokho" },
  download: { en: "Download", hi: "Download" },
  preview: { en: "Preview", hi: "Suno" },
  previewing: { en: "Loading voice...", hi: "Voice aa rahi hai..." },
  search: { en: "Search voices", hi: "Voice khojo" },
  gender: { en: "Gender", hi: "Gender" },
  language: { en: "Language", hi: "Bhasha" },
  emotion: { en: "Emotion", hi: "Emotion" },
  style: { en: "Style", hi: "Style" },
  age: { en: "Age", hi: "Umar" },
  any: { en: "Any", hi: "Koi bhi" },
  select: { en: "Select", hi: "Select karo" },
  selected: { en: "Selected", hi: "Selected" },
  voicesTitle: { en: "400 Voice Library", hi: "400 Voice Library" },
  voicesSub: {
    en: "Every profile from the Zorvexa library, connected to a real voice engine.",
    hi: "Zorvexa library ke saare profiles, real voice engine se jude hue.",
  },
  sharedBase: { en: "Shared base voice", hi: "Shared base voice" },
  engineOff: { en: "Engine not connected", hi: "Engine connected nahi" },
  resultsCount: { en: "profiles", hi: "profiles" },
  loadMore: { en: "Load more", hi: "Aur dikhao" },
  reset: { en: "Reset filters", hi: "Filter hatao" },
  noResults: { en: "No voices match these filters.", hi: "In filters par koi voice nahi mili." },
} as const;

export type StringKey = keyof typeof STRINGS;

/** Pure Hindi (Devanagari). Missing keys fall back to English + Hindi. */
const HINDI: Partial<Record<StringKey, string>> = {
  tagline: "ऑल इन वन",
  navStudio: "स्टूडियो",
  navVoices: "आवाज़ लाइब्रेरी",
  navProjects: "प्रोजेक्ट्स",
  navSettings: "सेटिंग्स",
  studioTitle: "वॉइस स्टूडियो",
  studioSub: "कहानी लिखें, किरदार पहचानें, हर लाइन में भाव जोड़ें और असली आवाज़ बनाएं।",
  projectName: "प्रोजेक्ट का नाम",
  script: "स्क्रिप्ट",
  scriptHint: "वैकल्पिक: ब्लॉक से पहले [Character] लिखें। भाव AI अपने आप लगाता है।",
  loadSample: "नमूना लोड करें",
  clear: "साफ़ करें",
  analyze: "विश्लेषण करें",
  analyzing: "विश्लेषण हो रहा है…",
  emotionAdd: "भाव जोड़ें",
  emotionAdding: "भाव जोड़े जा रहे हैं…",
  characters: "किरदार",
  noCharacters: "किरदारों की सूची के लिए विश्लेषण करें दबाएँ।",
  assignVoice: "आवाज़ चुनें",
  lines: "लाइनें",
  words: "शब्द",
  speed: "गति",
  storyLines: "कहानी की लाइनें",
  emotionLocked: "भाव तय",
  noEmotion: "कोई भाव नहीं",
  generate: "आवाज़ बनाएं",
  generating: "बन रहा है…",
  play: "चलाएँ",
  pause: "रोकें",
  download: "डाउनलोड",
  preview: "सुनें",
  previewing: "चल रहा है…",
  search: "खोजें",
  gender: "लिंग",
  language: "भाषा",
  emotion: "भाव",
  style: "शैली",
  age: "उम्र",
  any: "कोई भी",
  select: "चुनें",
  selected: "चुना गया",
  voicesTitle: "आवाज़ लाइब्रेरी",
  voicesSub: "सभी आवाज़ प्रोफ़ाइल, असली वॉइस इंजन से जुड़ी हुई।",
  resultsCount: "प्रोफ़ाइल",
  loadMore: "और दिखाएँ",
  reset: "फ़िल्टर हटाएँ",
  noResults: "इन फ़िल्टर पर कोई आवाज़ नहीं मिली।",
};

/** en = English, hi = English + Hindi (Hinglish), hd = Hindi. */
export type UiLang = Lang | "hd";
export const LANG_OPTIONS: { id: UiLang; db: "en" | "hinglish" | "hi"; label: string; sub: string }[] = [
  { id: "en", db: "en", label: "English", sub: "Everything in English" },
  { id: "hi", db: "hinglish", label: "English + Hindi", sub: "Hinglish mix" },
  { id: "hd", db: "hi", label: "हिंदी", sub: "पूरी वेबसाइट हिंदी में" },
];
export const langFromDb = (v: string | null | undefined): UiLang | null =>
  LANG_OPTIONS.find((o) => o.db === v)?.id ?? null;

const Ctx = createContext<{
  lang: Lang;
  uiLang: UiLang;
  setLang: (l: UiLang) => void;
  t: (k: StringKey) => string;
}>({
  lang: "en",
  uiLang: "en",
  setLang: () => {},
  t: (k) => STRINGS[k].en,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [uiLang, setUi] = useState<UiLang>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem("mn-lang");
    if (stored === "en" || stored === "hi" || stored === "hd") setUi(stored);
  }, []);

  const value = useMemo(
    () => ({
      uiLang,
      // Existing screens branch on "hi" for non-English copy; Hindi reuses it.
      lang: (uiLang === "en" ? "en" : "hi") as Lang,
      setLang: (l: UiLang) => {
        setUi(l);
        window.localStorage.setItem("mn-lang", l);
      },
      t: (k: StringKey) => (uiLang === "hd" ? (HINDI[k] ?? STRINGS[k].hi) : STRINGS[k][uiLang]),
    }),
    [uiLang],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx);
}
