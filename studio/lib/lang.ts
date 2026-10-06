// The UI language, with no imports (the store and the dictionaries both need it).
export type Lang = "ar" | "en";

export const LANG_KEY = "cc-lang";

/** The user's last choice, else the browser's language (Arabic → ar, anything else → en). */
export function initialLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_KEY);
    if (v === "ar" || v === "en") return v;
  } catch {
    /* storage blocked */
  }
  return typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("ar") ? "ar" : "en";
}

export const dirOf = (lang: Lang) => (lang === "ar" ? "rtl" : "ltr");

/** Shortcut modifier as shown in the UI: ⌘ on a Mac, Ctrl elsewhere (the handlers accept both). */
export const MOD = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl+";

const RTL_LANGS = new Set(["ar", "fa", "ur", "he", "yi", "ps", "sd", "ug", "ckb", "dv"]);

/** Direction of the video's own words (captions, transcript): from the language Whisper detected,
 *  else from the script of the first words. Independent of the UI language. */
export function contentDir(p: { analysis?: Record<string, unknown>; words: { text: string }[] }): "rtl" | "ltr" {
  const lang = typeof p.analysis?.language === "string" ? (p.analysis.language as string) : "";
  if (lang) return RTL_LANGS.has(lang) ? "rtl" : "ltr";
  return /[\u0590-\u08FF]/.test(p.words.slice(0, 60).map((w) => w.text).join(" ")) ? "rtl" : "ltr";
}
