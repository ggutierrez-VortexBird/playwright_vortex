import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";
import { TOKENS_M3 } from "./lib/design-tokens";


const fuenteSans = ["var(--font-archivo)", "system-ui", "sans-serif"];

const config: Config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        m3: Object.fromEntries(TOKENS_M3.map((t) => [t, `rgb(var(--m3-${t}) / <alpha-value>)`])),
      },
      fontFamily: {
        sans: fuenteSans,
        display: fuenteSans,
        headline: fuenteSans,
        body: fuenteSans,
        label: fuenteSans,
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "Consolas", "monospace"],
        "mono-code": ["var(--font-jetbrains-mono)", "ui-monospace", "Consolas", "monospace"],
      },
      fontSize: {
        "display-md": ["28px", { lineHeight: "36px", letterSpacing: "-0.02em", fontWeight: "700" }],
        display: ["24px", { lineHeight: "32px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-lg": ["20px", { lineHeight: "28px", fontWeight: "600" }],
        "headline-md": ["18px", { lineHeight: "24px", fontWeight: "600" }],
        "headline-sm": ["16px", { lineHeight: "22px", fontWeight: "600" }],
        "body-lg": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "body-md": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "body-sm": ["13px", { lineHeight: "18px", fontWeight: "400" }],
        "body-xs": ["12px", { lineHeight: "16px", fontWeight: "400" }],
        "label-lg": ["14px", { lineHeight: "20px", letterSpacing: "0.01em", fontWeight: "600" }],
        "label-md": ["13px", { lineHeight: "18px", letterSpacing: "0.01em", fontWeight: "500" }],
        "label-sm": ["12px", { lineHeight: "16px", letterSpacing: "0.01em", fontWeight: "500" }],
        "label-xs": ["11px", { lineHeight: "14px", letterSpacing: "0.02em", fontWeight: "500" }],
        "mono-code": ["13px", { lineHeight: "18px", fontWeight: "400" }],
      },
      spacing: {
        rail: "224px",
      },
      borderRadius: {
        lg: "var(--radius-lg)",
        md: "var(--radius-md)",
        sm: "var(--radius-sm)",
      },
      boxShadow: {
        card: "0 1px 2px rgb(var(--m3-shadow) / 0.05), 0 8px 24px -12px rgb(var(--m3-shadow) / 0.18)",
        "card-hover": "0 4px 8px rgb(var(--m3-shadow) / 0.07), 0 16px 32px -16px rgb(var(--m3-shadow) / 0.26)",
        modal: "0 8px 16px rgb(var(--m3-shadow) / 0.10), 0 24px 48px -12px rgb(var(--m3-shadow) / 0.34)",
      },
      zIndex: {
        sticky: "20",
        dropdown: "30",
        overlay: "40",
        modal: "50",
        toast: "60",
        tooltip: "70",
      },
      transitionTimingFunction: {
        standard: "var(--ease-standard)",
        emphasized: "var(--ease-emphasized)",
      },
      transitionDuration: {
        fast: "var(--duration-fast)",
        base: "var(--duration-base)",
        slow: "var(--duration-slow)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
