/** @type {import('tailwindcss').Config} */
const config = {
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-geist-sans)",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        mono: [
          "var(--font-geist-mono)",
          "JetBrains Mono",
          "Fira Code",
          "SF Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
        data: [
          "JetBrains Mono",
          "Fira Code",
          "SF Mono",
          "var(--font-geist-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      borderRadius: {
        none: "0",
        sm: "0.125rem",
        DEFAULT: "0.125rem",
        md: "0.125rem",
        lg: "0.125rem",
        xl: "0.25rem",
        "2xl": "0.25rem",
        "3xl": "0.375rem",
      },
      colors: {
        cyber: "#00f0ff",
        toxic: "#39ff14",
      },
    },
  },
};

export default config;
