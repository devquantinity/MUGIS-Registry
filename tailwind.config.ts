import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
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
