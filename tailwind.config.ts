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
      },
      fontFamily: {
        sans: ["var(--font-archivo)", "Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
        mono: ["var(--font-ibm-plex-mono)", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
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
