import { useMemo } from "react";
import { cn } from "@/lib/cn";

export interface MoodChipDef {
  /** Stable id (also seeds the generated thumbnail palette). */
  id: string;
  /** Display label (e.g., "Cyberpunk"). */
  label: string;
  /** Optional override for the radial palette. */
  palette?: { hot: string; mid: string; dark: string };
}

export interface MoodChipProps {
  chip: MoodChipDef;
  selected?: boolean;
  onToggle?: (id: string) => void;
  size?: "sm" | "md";
}

const SIZE_PX: Record<NonNullable<MoodChipProps["size"]>, number> = {
  sm: 72,
  md: 96,
};

/** A 1:1 generated-look thumbnail + label chip used by Studio prompt. */
export function MoodChip({ chip, selected = false, onToggle, size = "md" }: MoodChipProps) {
  const px = SIZE_PX[size];
  const palette = useMemo(() => deriveMoodPalette(chip), [chip]);
  const bg = useMemo(
    () =>
      [
        `radial-gradient(circle at 30% 30%, ${palette.hot} 0%, transparent 45%)`,
        `radial-gradient(circle at 70% 70%, ${palette.mid} 0%, transparent 50%)`,
        `linear-gradient(160deg, ${palette.dark} 0%, #0a0a0c 100%)`,
      ].join(", "),
    [palette],
  );

  return (
    <button
      type="button"
      data-testid={`mood-chip-${chip.id}`}
      data-selected={selected}
      aria-pressed={selected}
      onClick={() => onToggle?.(chip.id)}
      className={cn(
        "group relative flex flex-col items-stretch text-left",
        "rounded-md overflow-hidden",
        "bg-elev-2 transition-all duration-fast ease-tune",
        "border border-glass-soft hover:border-glass",
        selected &&
          "border-molten/40 shadow-[0_0_22px_-8px_var(--mvfm-molten-dim)] bg-molten-tint",
      )}
      style={{ width: px }}
    >
      <div
        data-testid="mood-chip-thumb"
        className="relative w-full overflow-hidden"
        style={{ height: px, background: bg }}
      >
        <div className="absolute inset-0 mvfm-grain opacity-60 pointer-events-none" />
        {/* Vignette */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.5) 100%)",
          }}
        />
        {/* Tick when selected */}
        {selected && (
          <span
            data-testid="mood-chip-tick"
            aria-hidden
            className="
              absolute top-1.5 right-1.5
              size-4 rounded-full
              grid place-items-center
              bg-molten text-base
            "
            style={{ color: "#1a0700", boxShadow: "0 0 10px var(--mvfm-molten-glow)" }}
          >
            <svg viewBox="0 0 12 12" fill="none" aria-hidden className="size-2.5">
              <path
                d="M2.5 6.5L4.8 8.6 9.3 3.8"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        )}
      </div>
      <span
        className={cn(
          "block px-1.5 py-1.5 truncate font-mono",
          "text-[10px] tracking-[0.06em]",
          selected ? "text-molten" : "text-silver group-hover:text-warm",
        )}
      >
        {chip.label}
      </span>
    </button>
  );
}

function deriveMoodPalette(chip: MoodChipDef): {
  hot: string;
  mid: string;
  dark: string;
} {
  if (chip.palette) return chip.palette;
  // Deterministic palette: hash chip.id, pick one of several warm/neutral
  // palettes (no purple/blue allowed).
  const palettes: Array<{ hot: string; mid: string; dark: string }> = [
    {
      hot: "rgba(255,106,31,0.45)",
      mid: "rgba(214,168,86,0.32)",
      dark: "#1a0c05",
    },
    {
      hot: "rgba(216,82,60,0.40)",
      mid: "rgba(214,158,82,0.28)",
      dark: "#150806",
    },
    {
      hot: "rgba(212,196,164,0.30)",
      mid: "rgba(140,120,90,0.24)",
      dark: "#181410",
    },
    {
      hot: "rgba(170,180,190,0.22)",
      mid: "rgba(62,90,102,0.30)",
      dark: "#0b0e10",
    },
    {
      hot: "rgba(255,138,61,0.34)",
      mid: "rgba(216,140,60,0.26)",
      dark: "#100804",
    },
    {
      hot: "rgba(154,160,171,0.18)",
      mid: "rgba(62,90,102,0.22)",
      dark: "#0d1014",
    },
  ];
  let h = 0;
  for (let i = 0; i < chip.id.length; i++) h = (h * 31 + chip.id.charCodeAt(i)) >>> 0;
  return palettes[h % palettes.length];
}

/** Canonical mood chip set for Studio prompt. 12 entries. */
export const STUDIO_MOODS: MoodChipDef[] = [
  { id: "cyberpunk", label: "Cyberpunk" },
  { id: "noir", label: "Noir" },
  { id: "pastoral", label: "Pastoral" },
  { id: "wartime", label: "Wartime" },
  { id: "orbital", label: "Orbital" },
  { id: "tavern", label: "Fantasy tavern" },
  { id: "pirate", label: "Pirate" },
  { id: "corporate", label: "Corporate" },
  { id: "apocalyptic", label: "Apocalyptic" },
  { id: "steampunk", label: "Steam-punk" },
  { id: "vapor-future", label: "Vapor-future" },
  { id: "hyperpop", label: "Hyperpop" },
];
