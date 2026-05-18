import { NavLink } from "react-router-dom";
import type { PackCategory } from "@multiverse/shared";
import { cn } from "@/lib/cn";

interface CategoryDef {
  key: PackCategory;
  label: string;
  hint: string;
  /** CSS background — warm palette per category, no purple/blue. */
  plate: string;
  accent?: string;
}

const CATEGORIES: ReadonlyArray<CategoryDef> = [
  {
    key: "music",
    label: "Music",
    hint: "Loops · beds · score cues",
    plate:
      "radial-gradient(circle at 70% 30%, rgba(216,168,86,0.30), transparent 55%), linear-gradient(165deg, #160807 0%, #0a0506 100%)",
  },
  {
    key: "sfx",
    label: "Sound effects",
    hint: "Stingers · transitions · impacts",
    plate:
      "radial-gradient(circle at 30% 30%, rgba(255,106,31,0.32), transparent 55%), linear-gradient(165deg, #1a0f08 0%, #0d0805 100%)",
  },
  {
    key: "voice_packs",
    label: "Voice packs",
    hint: "Narration · NPCs · ads",
    plate:
      "radial-gradient(circle at 50% 30%, rgba(212,196,164,0.22), transparent 50%), linear-gradient(165deg, #1d160e 0%, #100a06 100%)",
  },
  {
    key: "ambient",
    label: "Ambient",
    hint: "Beds · loops · world tone",
    plate:
      "radial-gradient(circle at 60% 60%, rgba(62,90,102,0.30), transparent 55%), linear-gradient(165deg, #0b1a1c 0%, #050a0c 100%)",
  },
  {
    key: "broadcast_packs",
    label: "Broadcast",
    hint: "Idents · ads · news beds",
    plate:
      "radial-gradient(circle at 30% 60%, rgba(214,82,60,0.30), transparent 55%), linear-gradient(165deg, #2a0a05 0%, #0a0202 100%)",
  },
  {
    key: "radio_packs",
    label: "Radio packs",
    hint: "4-min in-world broadcasts",
    plate:
      "radial-gradient(circle at 50% 50%, rgba(255,106,31,0.20), transparent 50%), linear-gradient(165deg, #1a0700 0%, #0a0202 100%)",
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
          to={`/browse/${c.key}`}
          data-testid={`category-${c.key}`}
          className="
            group relative overflow-hidden rounded-md
            aspect-[4/3] sm:aspect-square
            border border-glass-soft hover:border-glass
            transition-all duration-fast ease-tune
            hover:-translate-y-0.5
            shadow-tile
          "
          style={{ background: c.plate }}
          aria-label={`Browse ${c.label}`}
        >
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
