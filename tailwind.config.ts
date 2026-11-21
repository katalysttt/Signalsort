import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#0f1b3d", 700: "#26325a", 500: "#4b5578", 400: "#6b7394", 300: "#9aa1bb" },
        brand: { 50: "#f3f1ff", 100: "#e8e4ff", 200: "#d2caff", 400: "#8b78f5", 500: "#6d55ee", 600: "#5b45e0", 700: "#4a35c2" },
        electric: { 500: "#2a78d6", 100: "#e3eefc" },
        pos: "#178f57",
        neg: "#d03b3b",
        neu: "#8d8c86",
        mix: "#7c5ce6",
        surface: "#f6f7fb",
        line: "#e6e8f0",
      },
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"] },
      boxShadow: { card: "0 1px 2px rgba(15,27,61,0.04), 0 4px 16px -8px rgba(15,27,61,0.08)" },
    },
  },
  plugins: [],
} satisfies Config;
