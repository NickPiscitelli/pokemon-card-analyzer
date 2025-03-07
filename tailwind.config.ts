import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
          "Apple Color Emoji",
          "Segoe UI Emoji",
          "Segoe UI Symbol",
          "Noto Color Emoji",
        ],
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        light: {
          "primary": "#2563eb",  // blue-600
          "secondary": "#10b981", // emerald-500
          "accent": "#f59e0b",   // amber-500
          "neutral": "#1f2937",  // gray-800
          "base-100": "#f9fafb", // gray-50
          "info": "#0ea5e9",     // sky-500
          "success": "#22c55e",  // green-500
          "warning": "#f59e0b",  // amber-500
          "error": "#ef4444",    // red-500
        },
        dark: {
          "primary": "#3b82f6",  // blue-500
          "secondary": "#34d399", // emerald-400
          "accent": "#fbbf24",   // amber-400
          "neutral": "#f9fafb",  // gray-50
          "base-100": "#1f2937", // gray-800
          "info": "#38bdf8",     // sky-400
          "success": "#4ade80",  // green-400
          "warning": "#fbbf24",  // amber-400
          "error": "#f87171",    // red-400
        },
      },
    ],
  },
} satisfies Config;
