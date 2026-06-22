"use client";

import { useLanguage } from "@/components/LanguageProvider";
import { translations } from "./translations";

export function useTranslation() {
  const { lang } = useLanguage();
  const dict = translations[lang];

  function t(path: string): any {
    const parts = path.split(".");
    let node: any = dict;
    for (const p of parts) {
      node = node?.[p];
      if (node === undefined) {
        // fallback to English if a key is missing in the active language
        let fallback: any = translations.en;
        for (const p2 of parts) fallback = fallback?.[p2];
        return fallback ?? path;
      }
    }
    return node;
  }

  return { t, lang };
}
