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
        sp: {
          bg:               "#eef2f8",
          sidebar:          "rgba(255,255,255,0.92)",
          card:             "#ffffff",
          "card-hover":     "#f7f9fc",
          border:           "#e4e9f0",
          brand:            "#3b82f6",
          "brand-hover":    "#2563eb",
          "brand-light":    "#eff6ff",
          "text-primary":   "#111827",
          "text-secondary": "#4b5563",
          "text-muted":     "#9ca3af",
        },
      },
      boxShadow: {
        card:  "0 1px 3px rgba(0,0,0,0.05), 0 6px 20px rgba(0,0,0,0.04)",
        glass: "0 1px 1px rgba(0,0,0,0.02), 0 4px 16px rgba(0,0,0,0.06), 0 16px 40px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.8)",
        panel: "0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.9)",
        sidebar: "2px 0 20px rgba(0,0,0,0.05), 1px 0 0 rgba(228,233,240,0.5)",
      },
    },
  },
  plugins: [],
};

export default config;
