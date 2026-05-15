import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#0A0A0C",
        elev: "#15161A",
        "elev-2": "#1E2026",
        molten: {
          DEFAULT: "#FF6A1F",
          glow: "#FF8A3D",
        },
        silver: "#9AA0AB",
        warm: "#F5F1EA",
        teal: { instr: "#3E5A66" },
      },
      fontFamily: {
        display: ["'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
        body: ["Inter", "ui-sans-serif", "system-ui"],
      },
      boxShadow: {
        panel: "0 1px 0 rgba(255,255,255,0.04) inset, 0 20px 60px rgba(0,0,0,0.6)",
        dial: "0 0 0 1px rgba(255,255,255,0.06), inset 0 -10px 30px rgba(0,0,0,0.7)",
        bloom: "0 0 60px 8px rgba(255,106,31,0.35)",
      },
      backdropBlur: {
        panel: "20px",
        sheet: "28px",
      },
      transitionTimingFunction: {
        tune: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
} satisfies Config;
