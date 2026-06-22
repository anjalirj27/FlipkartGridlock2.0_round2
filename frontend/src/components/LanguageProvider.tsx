"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Lang = "en" | "hi" | "kn";
export const LANG_LABELS: Record<Lang, string> = { en: "English", hi: "\u0939\u093F\u0928\u094D\u0926\u0940", kn: "\u0C95\u0CA8\u0CCD\u0CA8\u0CA1" };

const LanguageContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: "en",
  setLang: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = localStorage.getItem("gridlock-lang") as Lang;
    if (saved && ["en", "hi", "kn"].includes(saved)) setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("gridlock-lang", l);
  };

  return <LanguageContext.Provider value={{ lang, setLang }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
