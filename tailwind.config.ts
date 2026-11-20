import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    // In this order, so each one wins over the ones before it. With raw media
    // queries here, Tailwind's min-[…] / max-* variants are off: use these.
    screens: {
      xs: "360px", // a regular phone; below it is a Galaxy Fold or an SE
      ...defaultTheme.screens,
      // `touch:` — fingers, not a mouse. Used to give controls a 44px target
      // without growing the desktop layout.
      touch: { raw: "(pointer: coarse)" },
      // A phone held sideways: every pixel of height counts.
      short: { raw: "(max-height: 500px)" },
    },
    extend: {
      colors: {
        // MUGIS theme — values live in src/app/globals.css (CSS vars).
        // Derived from the official MUGIS mark: deep green + gold.
        cream: "rgb(var(--color-cream) / <alpha-value>)",
        paper: "rgb(var(--color-paper) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        soot: "rgb(var(--color-soot) / <alpha-value>)",
        line: "rgb(var(--color-line) / <alpha-value>)",
        forest: {
          50: "rgb(var(--color-forest-50) / <alpha-value>)",
          100: "rgb(var(--color-forest-100) / <alpha-value>)",
          200: "rgb(var(--color-forest-200) / <alpha-value>)",
          500: "rgb(var(--color-forest-500) / <alpha-value>)",
          600: "rgb(var(--color-forest-600) / <alpha-value>)",
          700: "rgb(var(--color-forest-700) / <alpha-value>)",
        },
        gold: {
          100: "rgb(var(--color-gold-100) / <alpha-value>)",
          300: "rgb(var(--color-gold-300) / <alpha-value>)",
          400: "rgb(var(--color-gold-400) / <alpha-value>)",
          500: "rgb(var(--color-gold-500) / <alpha-value>)",
          600: "rgb(var(--color-gold-600) / <alpha-value>)",
        },
        goldink: "rgb(var(--color-goldink) / <alpha-value>)",
        sage: {
          100: "rgb(var(--color-sage-100) / <alpha-value>)",
          600: "rgb(var(--color-sage-600) / <alpha-value>)",
          700: "rgb(var(--color-sage-700) / <alpha-value>)",
        },
        danger: {
          50: "rgb(var(--color-danger-50) / <alpha-value>)",
          200: "rgb(var(--color-danger-200) / <alpha-value>)",
          600: "rgb(var(--color-danger-600) / <alpha-value>)",
          700: "rgb(var(--color-danger-700) / <alpha-value>)",
        },
      },
      // Type scale nudged up ~1px at the small end, where this app lives.
      // Line heights grow with it so dense tables keep breathing room.
      fontSize: {
        xs: ["0.875rem", { lineHeight: "1.25rem" }],     // 14px (Tailwind default 12)
        sm: ["1rem", { lineHeight: "1.5rem" }],          // 16px (default 14)
        base: ["1.125rem", { lineHeight: "1.75rem" }],   // 18px (default 16)
        lg: ["1.25rem", { lineHeight: "1.875rem" }],     // 20px (default 18)
        xl: ["1.375rem", { lineHeight: "1.9375rem" }],   // 22px (default 20)
        "2xl": ["1.75rem", { lineHeight: "2.25rem" }],   // 28px (default 24)
        "3xl": ["2rem", { lineHeight: "2.375rem" }],     // 32px (was 30)
        "4xl": ["2.375rem", { lineHeight: "2.625rem" }], // 38px (was 36)
        "5xl": ["3.125rem", { lineHeight: "1" }],        // 50px (was 48)
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        display: [
          "var(--font-inter)",
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgb(10 30 20 / 0.04)",
        raised: "0 1px 2px rgb(10 30 20 / 0.06), 0 8px 24px rgb(10 30 20 / 0.10)",
        gold: "0 2px 8px rgb(200 134 30 / 0.30)",
        nav: "0 -2px 14px rgb(10 30 20 / 0.07)",
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "0.875rem",
        "3xl": "1.25rem",
      },
    },
  },
  plugins: [],
};
export default config;
