"use client";

import {
  appearances,
  useAppearance,
  type Appearance,
} from "@/components/appearance-provider";
import { AppShell } from "@/components/app-shell";
import {
  supportedLocales,
  type SupportedLocale,
  type TranslationKey,
} from "@/i18n/translations";
import { useTranslations } from "@/i18n/use-translations";

const languageLabels: Record<SupportedLocale, TranslationKey> = {
  "sr-Latn": "language.serbian",
  en: "language.english",
};

const appearanceLabels: Record<Appearance, TranslationKey> = {
  system: "appearance.system",
  light: "appearance.light",
  dark: "appearance.dark",
};

export default function SettingsPage() {
  const { locale, setLocale, t } = useTranslations();
  const { appearance, setAppearance } = useAppearance();

  return (
    <AppShell
      title={t("settings.title")}
      description={t("settings.description")}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <section
          aria-labelledby="settings-language-heading"
          className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm"
        >
          <h2
            id="settings-language-heading"
            className="text-base font-semibold tracking-tight text-slate-950"
          >
            {t("language.label")}
          </h2>
          <div
            role="radiogroup"
            aria-labelledby="settings-language-heading"
            className="mt-4 flex flex-wrap gap-2"
          >
            {supportedLocales.map((value) => (
              <PreferenceOption
                key={value}
                label={t(languageLabels[value])}
                isSelected={locale === value}
                onSelect={() => setLocale(value)}
              />
            ))}
          </div>
        </section>

        <section
          aria-labelledby="settings-appearance-heading"
          className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm"
        >
          <h2
            id="settings-appearance-heading"
            className="text-base font-semibold tracking-tight text-slate-950"
          >
            {t("appearance.label")}
          </h2>
          <div
            role="radiogroup"
            aria-labelledby="settings-appearance-heading"
            className="mt-4 flex flex-wrap gap-2"
          >
            {appearances.map((value) => (
              <PreferenceOption
                key={value}
                label={t(appearanceLabels[value])}
                isSelected={appearance === value}
                onSelect={() => setAppearance(value)}
              />
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function PreferenceOption({
  label,
  isSelected,
  onSelect,
}: {
  label: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      onClick={onSelect}
      className={`inline-flex min-h-10 min-w-[7.5rem] items-center justify-center rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
        isSelected
          ? "border-blue-700 bg-blue-50 font-semibold text-blue-800"
          : "border-slate-300 bg-white font-medium text-slate-700 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}
