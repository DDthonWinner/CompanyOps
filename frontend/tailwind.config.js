/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        "on-background": "var(--on-background)",
        surface: {
          lowest: "var(--surface-container-lowest)",
          low: "var(--surface-container-low)",
          DEFAULT: "var(--surface-container)",
          high: "var(--surface-container-high)",
          highest: "var(--surface-container-highest)",
        },
        outline: "var(--outline)",
        "outline-variant": "var(--outline-variant)",
        primary: "var(--primary)",
        secondary: "var(--secondary)",
        error: "var(--error)",
        // discipline accents (Design §5.2)
        fe: "#4f46e5",
        be: "#059669",
        db: "#d97706",
        qa: "#0284c7",
        pm: "#e11d48",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      borderRadius: { hud: "1rem" },
    },
  },
  plugins: [],
};
