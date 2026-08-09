"use client";

/**
 * Appearance: light/dark mode + accent colour, persisted per browser.
 * The CSS custom properties in globals.css do the heavy lifting — this
 * provider sets `.dark` and `data-accent` on <html>, and exposes the
 * accent's chart ramp (SVG ramps need real hex values, not CSS vars).
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ThemeMode = "light" | "dark";
export type Accent = "forest" | "blue" | "amber" | "orange" | "purple";

const KEY = "mugis.theme.v1";

/** Picker order; swatches are brightened hue chips for the dark sidebar. */
export const ACCENTS: { id: Accent; label: string; swatch: string }[] = [
  { id: "forest", label: "MUGIS green", swatch: "#12854E" },
  { id: "blue", label: "Blue", swatch: "#2F6FC4" },
  { id: "amber", label: "Yellow", swatch: "#D9A21B" },
  { id: "orange", label: "Orange", swatch: "#E05A1F" },
  { id: "purple", label: "Purple", swatch: "#8B4BE8" },
];

type Rgb = [number, number, number];

/** Accent 500s — must match the [data-accent] blocks in globals.css. */
const BASE: Record<Accent, Rgb> = {
  forest: [0, 108, 56],
  blue: [30, 95, 174],
  amber: [150, 105, 11],
  orange: [194, 65, 12],
  purple: [109, 40, 217],
};

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
const GREY: Rgb = [17, 17, 17];

const mix = (a: Rgb, b: Rgb, t: number): Rgb =>
  [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as Rgb;
const hex = (c: Rgb) => `#${c.map((x) => x.toString(16).padStart(2, "0")).join("")}`;

/** Single-hue ramp for ordered data (stage severity), themed per accent + mode. */
export function rampFor(accent: Accent, mode: ThemeMode): (t: number) => string {
  const base = BASE[accent];
  const darkBg = mix(GREY, base, 0.05); // matches the .dark neutrals in globals.css
  const from = mode === "dark" ? mix(darkBg, base, 0.4) : mix(WHITE, base, 0.28);
  const to = mode === "dark" ? mix(base, WHITE, 0.5) : mix(base, BLACK, 0.36);
  return (t) => hex(mix(from, to, Math.max(0, Math.min(1, t))));
}

type ThemeCtx = {
  mode: ThemeMode;
  accent: Accent;
  setMode: (m: ThemeMode) => void;
  setAccent: (a: Accent) => void;
  /** Ordered single-hue ramp in the current accent + mode. t in [0,1]. */
  ramp: (t: number) => string;
};

const Ctx = createContext<ThemeCtx | null>(null);

function readSaved(): { mode: ThemeMode; accent: Accent } | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { mode?: string; accent?: string };
    return {
      mode: p.mode === "dark" ? "dark" : "light",
      accent: ACCENTS.some((a) => a.id === p.accent) ? (p.accent as Accent) : "forest",
    };
  } catch {
    return null;
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Lazy init from storage — safe because everything that consumes the theme
  // mounts after the auth/store gates, i.e. post-hydration.
  const [mode, setModeState] = useState<ThemeMode>(
    () => (typeof window === "undefined" ? "light" : readSaved()?.mode ?? "light")
  );
  const [accent, setAccentState] = useState<Accent>(
    () => (typeof window === "undefined" ? "forest" : readSaved()?.accent ?? "forest")
  );

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", mode === "dark");
    root.setAttribute("data-accent", accent);
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ mode, accent }));
    } catch {
      /* ignore */
    }
  }, [mode, accent]);

  const setMode = useCallback((m: ThemeMode) => setModeState(m), []);
  const setAccent = useCallback((a: Accent) => setAccentState(a), []);
  const ramp = useMemo(() => rampFor(accent, mode), [accent, mode]);

  const value = useMemo(
    () => ({ mode, accent, setMode, setAccent, ramp }),
    [mode, accent, setMode, setAccent, ramp]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
