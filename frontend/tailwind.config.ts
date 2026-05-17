import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "var(--mvfm-bg-base)",
        elev: "var(--mvfm-bg-elev)",
        "elev-2": "var(--mvfm-bg-elev-2)",
        "elev-3": "var(--mvfm-bg-elev-3)",
        molten: {
          DEFAULT: "var(--mvfm-molten)",
          glow: "var(--mvfm-molten-glow)",
          dim: "var(--mvfm-molten-dim)",
          tint: "var(--mvfm-molten-tint)",
        },
        warm: "var(--mvfm-text)",
        silver: "var(--mvfm-text-2)",
        silver2: "var(--mvfm-text-3)",
        teal: { instr: "var(--mvfm-teal)" },
      },
      fontFamily: {
        display: "var(--mvfm-mono)",
        mono: "var(--mvfm-mono)",
        body: "var(--mvfm-sans)",
      },
      borderColor: {
        glass: "var(--mvfm-border)",
        "glass-strong": "var(--mvfm-border-strong)",
        "glass-soft": "var(--mvfm-border-soft)",
      },
      borderRadius: {
        xs: "var(--mvfm-radius-xs)",
        sm: "var(--mvfm-radius-sm)",
        md: "var(--mvfm-radius-md)",
        lg: "var(--mvfm-radius-lg)",
        xl: "var(--mvfm-radius-xl)",
        "2xl": "var(--mvfm-radius-2xl)",
        pill: "var(--mvfm-radius-pill)",
      },
      boxShadow: {
        panel: "var(--mvfm-shadow-panel)",
        bloom: "var(--mvfm-shadow-bloom)",
        tile: "var(--mvfm-shadow-tile)",
        dial: "var(--mvfm-shadow-dial)",
      },
      backdropBlur: {
        panel: "var(--mvfm-blur-panel)",
        sheet: "var(--mvfm-blur-sheet)",
      },
      transitionTimingFunction: {
        tune: "var(--mvfm-ease)",
      },
      transitionDuration: {
        fast: "var(--mvfm-dur-fast)",
        tune: "var(--mvfm-dur-tune)",
        slow: "var(--mvfm-dur-slow)",
        lock: "var(--mvfm-dur-lock)",
      },
      spacing: {
        sidebar: "var(--mvfm-sidebar-w)",
        "sidebar-collapsed": "var(--mvfm-sidebar-w-collapsed)",
        topbar: "var(--mvfm-topbar-h)",
        bottomplayer: "var(--mvfm-bottomplayer-h)",
        rightpanel: "var(--mvfm-rightpanel-w)",
      },
    },
  },
  plugins: [],
} satisfies Config;
