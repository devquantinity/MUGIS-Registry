"use client";

/**
 * Appearance is fixed: light mode with the yellow ("amber") accent. There is no
 * picker; `data-accent` is set on <html> in layout.tsx, and globals.css still
 * holds the other accents and the dark mode in case a picker comes back.
 * This provider exposes the accent's chart ramp (SVG ramps need real hex
 * values, not CSS vars).
 */
import React, { createContext, useContext, useMemo } from "react";

export type ThemeMode = "light" | "dark";
export type Accent = "forest" | "blue" | "amber" | "orange" | "purple";

/** The one theme the app uses. */
export const THEME = { mode: "light", accent: "amber" } as const satisfies { mode: ThemeMode; accent: Accent };

type Rgb = [number, number, number];

/** Accent 500s — must match the [data-accent] blocks in globals.css. */
const BASE: Record<Accent, Rgb> = {
  forest: [0, 108, 56],
  blue: [30, 95, 174],
  amber: [135, 95, 10],
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
  /** Ordered single-hue ramp in the app's accent + mode. t in [0,1]. */
  ramp: (t: number) => string;
};

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo(
    () => ({ mode: THEME.mode, accent: THEME.accent, ramp: rampFor(THEME.accent, THEME.mode) }),
    []
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
