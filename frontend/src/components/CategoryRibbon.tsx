import { NavLink } from "react-router-dom";
import { cn } from "@/lib/cn";

interface CategoryDef {
  /** Slug for test id. */
  key: string;
  /** Route target. */
  to: string;
  label: string;
  hint: string;
  /** CSS background — warm palette per category, no purple/blue. */
  plate: string;
  accent?: string;
  comingSoon?: boolean;
}

const CATEGORIES: ReadonlyArray<CategoryDef> = [
  {
    key: "music",
    to: "/browse/music",
    label: "Music",
    hint: "Loops · beds · score cues",
    plate:
      "radial-gradient(circle at 70% 30%, rgba(216,168,86,0.30), transparent 55%), linear-gradient(165deg, #160807 0%, #0a0506 100%)",
  },
  {
    key: "sfx",
    to: "/browse/sfx",
    label: "Sound effects",
    hint: "Stingers · transitions · impacts",
    plate:
      "radial-gradient(circle at 30% 30%, rgba(255,106,31,0.32), transparent 55%), linear-gradient(165deg, #1a0f08 0%, #0d0805 100%)",
  },
  {
    key: "voices",
    to: "/voices",
    label: "Voices",
    hint: "Character voices · TTS access",
    plate:
      "radial-gradient(circle at 50% 30%, rgba(212,196,164,0.22), transparent 50%), linear-gradient(165deg, #1d160e 0%, #100a06 100%)",
  },
  {
    key: "ambient",
    to: "/browse/ambient",
    label: "Ambient",
    hint: "Beds · loops · world tone",
    plate:
      "radial-gradient(circle at 60% 60%, rgba(62,90,102,0.30), transparent 55%), linear-gradient(165deg, #0b1a1c 0%, #050a0c 100%)",
  },
  {
    key: "broadcast_packs",
    to: "/browse/broadcast_packs",
    label: "Broadcast",
    hint: "Idents · ads · news beds",
    plate:
      "radial-gradient(circle at 30% 60%, rgba(214,82,60,0.30), transparent 55%), linear-gradient(165deg, #2a0a05 0%, #0a0202 100%)",
    comingSoon: true,
  },
  {
    key: "radio_packs",
    to: "/browse/radio_packs",
    label: "Radio packs",
    hint: "4-min in-world broadcasts",
    plate:
      "radial-gradient(circle at 50% 50%, rgba(255,106,31,0.20), transparent 50%), linear-gradient(165deg, #1a0700 0%, #0a0202 100%)",
    comingSoon: true,
  },
];

export interface CategoryRibbonProps {
  className?: string;
}

export function CategoryRibbon({ className }: CategoryRibbonProps) {
  return (
    <section
      data-testid="category-ribbon"
      aria-label="Browse by category"
      className={cn(
        "grid gap-3",
        "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
        className,
      )}
    >
      {CATEGORIES.map((c) => (
        <NavLink
          key={c.key}
          to={c.to}
          data-testid={`category-${c.key}`}
          onClick={(e) => {
            if (c.comingSoon) e.preventDefault();
          }}
          aria-disabled={c.comingSoon}
          className={cn(
            "group relative overflow-hidden rounded-md",
            "aspect-[4/3] sm:aspect-square",
            "border border-glass-soft transition-all duration-fast ease-tune",
            "shadow-tile",
            c.comingSoon
              ? "cursor-not-allowed opacity-70"
              : "hover:border-glass hover:-translate-y-0.5",
          )}
          style={{ background: c.plate }}
          aria-label={`Browse ${c.label}`}
        >
          {c.comingSoon && (
            <span className="absolute top-1.5 right-1.5 z-[3] px-1.5 py-0.5 rounded-pill bg-molten-tint border border-molten/40 font-mono text-molten text-[8px] tracking-[0.22em] uppercase">
              Soon
            </span>
          )}
          <div aria-hidden className="absolute inset-0 mvfm-grain opacity-60 pointer-events-none" />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,0.7) 100%)",
            }}
          />
          <div className="absolute left-2.5 bottom-2 right-2.5 z-[2]">
            <div className="font-mono text-warm text-[11px] sm:text-[12px] tracking-[0.04em] truncate">
              {c.label}
            </div>
            <div className="font-mono text-silver2 text-[9px] tracking-[0.14em] uppercase mt-0.5 truncate">
              {c.hint}
            </div>
          </div>
        </NavLink>
      ))}
    </section>
  );
}
