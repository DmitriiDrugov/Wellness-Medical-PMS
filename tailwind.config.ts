import type { Config } from "tailwindcss";

/**
 * Tailwind theme mirrors the Stitch "Serene Pro Management" design system 1:1
 * (see ui/stitch-export + docs project DESIGN.md). Color keys match the names the
 * imported mockups use (bg-primary, text-on-surface, …) so ported markup keeps its classes.
 */
const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./src/web/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#fbf9f6",
        "on-background": "#1b1c1a",
        surface: "#fbf9f6",
        "surface-bright": "#fbf9f6",
        "surface-dim": "#dcdad7",
        "surface-variant": "#e4e2df",
        "surface-tint": "#0b6a61",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f5f3f0",
        "surface-container": "#f0edea",
        "surface-container-high": "#eae8e5",
        "surface-container-highest": "#e4e2df",
        "on-surface": "#1b1c1a",
        "on-surface-variant": "#3f4947",
        "inverse-surface": "#30302f",
        "inverse-on-surface": "#f3f0ed",
        outline: "#6f7977",
        "outline-variant": "#bec9c6",
        primary: "#05685f",
        "on-primary": "#ffffff",
        "primary-container": "#2f8177",
        "on-primary-container": "#f4fffc",
        "inverse-primary": "#86d5c9",
        "primary-fixed": "#a2f1e5",
        "primary-fixed-dim": "#86d5c9",
        "on-primary-fixed": "#00201d",
        "on-primary-fixed-variant": "#005049",
        secondary: "#58605c",
        "on-secondary": "#ffffff",
        "secondary-container": "#dce4df",
        "on-secondary-container": "#5e6662",
        "secondary-fixed": "#dce4df",
        "secondary-fixed-dim": "#c0c8c4",
        "on-secondary-fixed": "#161d1a",
        "on-secondary-fixed-variant": "#414845",
        tertiary: "#545e5c",
        "on-tertiary": "#ffffff",
        "tertiary-container": "#6c7774",
        "on-tertiary-container": "#f4fffc",
        "tertiary-fixed": "#dae5e2",
        "tertiary-fixed-dim": "#bec9c6",
        "on-tertiary-fixed": "#141d1c",
        "on-tertiary-fixed-variant": "#3f4947",
        error: "#ba1a1a",
        "on-error": "#ffffff",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a",
        // Semantic accents from DESIGN.md (housekeeping/status pills)
        success: "#66a690",
        warning: "#d4a373",
        info: "#8e9aaf",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        lg: "1rem",
        xl: "1.5rem",
        full: "9999px",
      },
      boxShadow: {
        card: "0px 4px 20px rgba(62, 142, 132, 0.05)",
        elevated: "0px 8px 28px rgba(27, 28, 26, 0.10)",
      },
      spacing: {
        sidebar: "260px",
      },
    },
  },
  plugins: [],
};

export default config;
