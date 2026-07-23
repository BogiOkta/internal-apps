"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  browserLocales,
  defaultLocale,
  isSupportedLocale,
  translations,
  type SupportedLocale,
  type Translate,
  type TranslationParameters,
} from "@/i18n/translations";

const localeStorageKey = "internal-apps.locale";

export type LocaleContextValue = {
  browserLocale: string;
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: Translate;
};

export const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(defaultLocale);

  useEffect(() => {
    const storedLocale = window.localStorage.getItem(localeStorageKey);
    if (storedLocale && isSupportedLocale(storedLocale)) {
      setLocaleState(storedLocale);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = translations[locale]["common.productName"];
  }, [locale]);

  const setLocale = useCallback((nextLocale: SupportedLocale) => {
    setLocaleState(nextLocale);
    window.localStorage.setItem(localeStorageKey, nextLocale);
  }, []);

  const t = useCallback<Translate>(
    (key, parameters?: TranslationParameters) => {
      let value: string = translations[locale][key];

      if (parameters) {
        for (const [parameter, replacement] of Object.entries(parameters)) {
          value = value.replaceAll(`{${parameter}}`, String(replacement));
        }
      }

      return value;
    },
    [locale],
  );

  const value = useMemo(
    () => ({
      browserLocale: browserLocales[locale],
      locale,
      setLocale,
      t,
    }),
    [locale, setLocale, t],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}
