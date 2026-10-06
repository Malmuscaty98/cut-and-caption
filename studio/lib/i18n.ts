// Editor UI in Arabic or English. Every visible string goes through `t("area.key", { vars })`;
// the dictionaries live in lib/i18n/<area>.ts as { ar: {...}, en: {...} } with the same keys.
import { useCallback, useEffect } from "react";
import { dirOf, LANG_KEY, type Lang } from "./lang";
import { common } from "./i18n/common";
import { inspector } from "./i18n/inspector";
import { shell } from "./i18n/shell";
import { timeline } from "./i18n/timeline";
import { useStore } from "./store";

export type { Lang } from "./lang";
export type Messages = Record<string, string>;
export type Bundle = { ar: Messages; en: Messages };
export type Vars = Record<string, string | number>;
export type T = (key: string, vars?: Vars) => string;

const BUNDLES: Bundle[] = [common, inspector, timeline, shell];
export const DICT: Record<Lang, Messages> = {
  ar: Object.assign({}, ...BUNDLES.map((b) => b.ar)),
  en: Object.assign({}, ...BUNDLES.map((b) => b.en)),
};

export function translate(lang: Lang, key: string, vars?: Vars): string {
  const s = DICT[lang][key] ?? DICT.en[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
}

/** For components. Outside React (store actions, helpers) use translate(useStore.getState().lang, …). */
export function useT(): T {
  const lang = useStore((s) => s.lang);
  return useCallback((key: string, vars?: Vars) => translate(lang, key, vars), [lang]);
}

/** Keep <html lang dir> in sync with the chosen language and remember it. */
export function useLangSync() {
  const lang = useStore((s) => s.lang);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dirOf(lang);
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      /* storage blocked */
    }
  }, [lang]);
}

export { dirOf };
