"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const appearanceStorageKey = "internal-apps.appearance";
export const appearances = ["light", "dark", "system"] as const;
export type Appearance = (typeof appearances)[number];
export type ResolvedAppearance = Exclude<Appearance, "system">;

type AppearanceContextValue = {
  appearance: Appearance;
  resolvedAppearance: ResolvedAppearance;
  setAppearance: (appearance: Appearance) => void;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<Appearance>("system");
  const [systemAppearance, setSystemAppearance] =
    useState<ResolvedAppearance>("light");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemAppearance = () =>
      setSystemAppearance(media.matches ? "dark" : "light");
    const storedAppearance = window.localStorage.getItem(appearanceStorageKey);

    updateSystemAppearance();
    if (isAppearance(storedAppearance)) setAppearanceState(storedAppearance);
    setIsReady(true);
    media.addEventListener("change", updateSystemAppearance);
    return () => media.removeEventListener("change", updateSystemAppearance);
  }, []);

  const resolvedAppearance =
    appearance === "system" ? systemAppearance : appearance;

  useEffect(() => {
    if (!isReady) return;
    applyAppearance(appearance, resolvedAppearance);
  }, [appearance, isReady, resolvedAppearance]);

  const setAppearance = useCallback((nextAppearance: Appearance) => {
    setAppearanceState(nextAppearance);
    window.localStorage.setItem(appearanceStorageKey, nextAppearance);
    const resolved =
      nextAppearance === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : nextAppearance;
    applyAppearance(nextAppearance, resolved);
  }, []);

  const value = useMemo(
    () => ({ appearance, resolvedAppearance, setAppearance }),
    [appearance, resolvedAppearance, setAppearance],
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) {
    throw new Error("useAppearance must be used inside AppearanceProvider.");
  }
  return context;
}

function isAppearance(value: string | null): value is Appearance {
  return appearances.includes(value as Appearance);
}

function applyAppearance(
  appearance: Appearance,
  resolvedAppearance: ResolvedAppearance,
) {
  const root = document.documentElement;
  root.dataset.appearance = appearance;
  root.dataset.theme = resolvedAppearance;
  root.style.colorScheme = resolvedAppearance;
}
