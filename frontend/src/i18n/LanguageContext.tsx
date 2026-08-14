import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import type { Lang } from "./strings";
import { pick, resolve } from "./strings";

const STORAGE_KEY = "ml.lang";

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** `t(S.section.entry)` pour une chaîne fixe, `t(S.section.entry)(arg)` pour une entrée paramétrée. */
  t: <T>(entry: { fr: T; en: T }) => T;
  /** Choisit un champ `_fr`/`_en` bilingue fourni par l'API (pays, indicateurs, événements). */
  pick: (fr: string, en: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readInitialLang(): Lang {
  if (typeof window === "undefined") return "fr";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "en" ? "en" : "fr";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readInitialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      setLang,
      t: (entry) => resolve(entry, lang),
      pick: (fr, en) => pick(lang, fr, en),
    }),
    [lang, setLang],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** Colocalisé avec le provider délibérément — un second fichier pour la seule
 * granularité du Fast Refresh imposerait de mettre à jour chacun de ses
 * ~15 points d'import, sans gain fonctionnel. */
// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage doit être utilisé sous LanguageProvider");
  return ctx;
}
