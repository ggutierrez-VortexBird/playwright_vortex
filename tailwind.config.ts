import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#131E2B",
          2: "#3A4B5C",
          3: "#6B7C8D",
        },
        paper: "#EEF2F5",
        surface: "#FFFFFF",
        rule: {
          DEFAULT: "#D7E0E7",
          soft: "#E7EDF1",
        },
        stamp: "#A8322A",
        seal: "#0E6B4F",
        amber: "#A9741A",
        param: "#3F3A7A",
        client: "#C9822F",
        // Material Design 3 — tokens for grabador screens (HU-G1).
        // Source: fase2/mockups/{nuevo-caso-video,grabar-test}.html.
        m3: {
          // Brand / primary
          "primary": "#000000",
          "on-primary": "#FFFFFF",
          "primary-container": "#131B2E",
          "on-primary-container": "#7C839B",
          "primary-fixed": "#DAE2FD",
          "primary-fixed-dim": "#BEC6E0",
          "on-primary-fixed": "#131B2E",
          "on-primary-fixed-variant": "#3F465C",
          // Secondary (amber)
          "secondary": "#855300",
          "on-secondary": "#FFFFFF",
          "secondary-container": "#FEA619",
          "on-secondary-container": "#684000",
          "secondary-fixed": "#FFDEB8",
          "secondary-fixed-dim": "#FFB95F",
          "on-secondary-fixed": "#2A1700",
          "on-secondary-fixed-variant": "#653E00",
          // Surface
          "background": "#F7F9FB",
          "surface": "#F7F9FB",
          "surface-dim": "#D8DADC",
          "surface-bright": "#F7F9FB",
          "surface-container-lowest": "#FFFFFF",
          "surface-container-low": "#F2F4F6",
          "surface-container": "#ECEEF0",
          "surface-container-high": "#E6E8EA",
          "surface-container-highest": "#E0E3E5",
          "surface-variant": "#E0E3E5",
          "surface-tint": "#565E74",
          "on-surface": "#191C1E",
          "on-surface-variant": "#45464D",
          "on-background": "#191C1E",
          // Inverse
          "inverse-surface": "#2D3133",
          "inverse-on-surface": "#EFF1F3",
          "inverse-primary": "#BEC6E0",
          // Outlines
          "outline": "#76777D",
          "outline-variant": "#C6C6CD",
          // Error
          "error": "#BA1A1A",
          "on-error": "#FFFFFF",
          "error-container": "#FFDAD6",
          "on-error-container": "#93000A",
          // Tertiary (mint)
          "tertiary": "#000000",
          "on-tertiary": "#FFFFFF",
          "tertiary-container": "#002113",
          "on-tertiary-container": "#009668",
          "tertiary-fixed": "#6FFBBE",
          "tertiary-fixed-dim": "#4EDEA3",
          "on-tertiary-fixed": "#002113",
          "on-tertiary-fixed-variant": "#005236",
        },
      },
      fontFamily: {
        sans: ["var(--font-archivo)", "Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
        mono: ["var(--font-ibm-plex-mono)", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
        // Material-Design 3 type roles used in grabador screens.
        // All aliases resolve to Inter (loaded as --font-inter).
        display: ["var(--font-inter)", "Inter", "Helvetica Neue", "Arial", "sans-serif"],
        headline: ["var(--font-inter)", "Inter", "Helvetica Neue", "Arial", "sans-serif"],
        body: ["var(--font-inter)", "Inter", "Helvetica Neue", "Arial", "sans-serif"],
        label: ["var(--font-inter)", "Inter", "Helvetica Neue", "Arial", "sans-serif"],
        // Mono role for URLs, IDs, and code-like labels.
        "mono-code": [
          "var(--font-jetbrains-mono)",
          "JetBrains Mono",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      fontSize: {
        display: ["24px", { lineHeight: "32px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-lg": ["20px", { lineHeight: "28px", fontWeight: "600" }],
        "headline-md": ["18px", { lineHeight: "24px", fontWeight: "600" }],
        "body-lg": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "body-md": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "label-sm": ["12px", { lineHeight: "16px", letterSpacing: "0.01em", fontWeight: "500" }],
        "mono-code": ["13px", { lineHeight: "18px", fontWeight: "400" }],
      },
      spacing: {
        rail: "224px",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
