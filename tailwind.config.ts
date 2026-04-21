import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      colors: {
        // Sales Progressor light theme tokens
        sp: {
          bg:         "#f0f4f8",
          sidebar:    "#ffffff",
          card:       "#ffffff",
          "card-hover": "#f7f9fc",
          border:     "#e4e9f0",
          brand:      "#3b82f6",
          "brand-hover": "#2563eb",
          "brand-light": "#eff6ff",
          "text-primary":   "#111827",
          "text-secondary": "#4b5563",
          "text-muted":     "#9ca3af",
        },
      },
    },
  },
  plugins: [],
};

export default config;
