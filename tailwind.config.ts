import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        // "Calm Slate" design system
        background: "#F8FAFC",
        surface: "#FFFFFF",
        primary: {
          DEFAULT: "#4F46E5",
          hover: "#4338CA",
        },
        accent: "#0D9488",
        danger: "#F87171",
        border: "#E2E8F0",
        ink: {
          primary: "#0F172A",
          secondary: "#64748B",
        },
      },
      borderRadius: {
        card: "10px",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.08)",
        panel: "-8px 0 24px -8px rgba(15, 23, 42, 0.12)",
      },
      keyframes: {
        "slide-in": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "slide-in": "slide-in 0.22s ease-out",
        "fade-in": "fade-in 0.15s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
