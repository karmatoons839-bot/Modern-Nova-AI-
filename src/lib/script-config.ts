/** Shared UI/server language allowlist; dialect output is experimental, not a certified translation. */
export const SCRIPT_LANGUAGES = [
  { name: "Hindi", native: "हिन्दी" }, { name: "English", native: "English" },
  { name: "Bengali", native: "বাংলা" }, { name: "Marathi", native: "मराठी" },
  { name: "Tamil", native: "தமிழ்" }, { name: "Telugu", native: "తెలుగు" },
  { name: "Gujarati", native: "ગુજરાતી" }, { name: "Kannada", native: "ಕನ್ನಡ" },
  { name: "Malayalam", native: "മലയാളം" }, { name: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { name: "Urdu", native: "اردو" }, { name: "Odia", native: "ଓଡ଼ିଆ" },
  { name: "Assamese", native: "অসমীয়া" }, { name: "Nepali", native: "नेपाली" },
  { name: "Bhojpuri", native: "भोजपुरी", experimental: true },
  { name: "Awadhi", native: "अवधी", experimental: true },
  { name: "Marwari", native: "मारवाड़ी", experimental: true },
  { name: "Haryanvi", native: "हरियाणवी", experimental: true },
] as const;

export function scriptLanguage(name: string) {
  return SCRIPT_LANGUAGES.find((language) => language.name === name);
}

export const SCRIPT_TYPES = [
  { id: "horror", label: "Horror script" },
  { id: "moral", label: "Moral script" },
] as const;
export type ScriptType = (typeof SCRIPT_TYPES)[number]["id"];