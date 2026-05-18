import type { Pack, PackCategory } from "@multiverse/shared";
import { cn } from "@/lib/cn";
import { plateFor } from "@/lib/stationArt";

export type PackTileSize = "lg" | "md" | "sm";

export interface PackTileProps {
  pack: Pack;
  size?: PackTileSize;
  active?: boolean;
  onSelect?: (id: string) => void;
  onPlay?: (id: string) => void;
}

const SIZE_PX: Record<PackTileSize, number> = { lg: 220, md: 180, sm: 132 };

/** Short labels for the category chip overlay on each tile. */
const CATEGORY_LABEL: Record<PackCategory, string> = {
  sfx: "SFX",
  music: "Music",
  voice_packs: "Voice",
  ambient: "Ambient",
  radio_packs: "Radio",
  broadcast_packs: "Broadcast",
};

export function PackTile({
  pack,
  size = "lg",
  active = false,
  onSelect,
  onPlay,
}: PackTileProps) {
  const px = SIZE_PX[size];
  const plate = plateFor(plateSeedFromPack(pack));

  return (
    <article
      data-testid={`pack-tile-${pack.id}`}
      data-active={active}
      data-size={size}
      className={cn(
        "group relative flex-shrink-0 snap-start rounded-md overflow-hidden",
        "bg-elev-2 shadow-[inset_0_0_0_1px_var(--mvfm-border-soft)]",
        "transition-transform duration-tune ease-tune",
        "hover:-translate-y-0.5",
        active &&
          "shadow-[inset_0_0_0_1.5px_var(--mvfm-molten),0_0_28px_-6px_var(--mvfm-molten-dim)]",
      )}
      style={{ width: px }}
    >
      <button
        type="button"
        onClick={() => onSelect?.(pack.id)}
        aria-label={`Open ${pack.title}`}
        className="block w-full text-left"
      >
        {/* Cover plate */}
        <div
          data-testid="pack-tile-cover"
          className="relative w-full overflow-hidden"
          style={{
            height: px,
            background: pack.cover_art_url
              ? `center / cover no-repeat url('${pack.cover_art_url}'), ${plate.background}`
              : plate.background,
          }}
        >
          {plate.accentLayer && !pack.cover_art_url && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: plate.accentLayer }}
              aria-hidden
            />
          )}
          <div className="absolute inset-0 mvfm-grain opacity-60 pointer-events-none" />
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)",
            }}
          />

          {/* Category chip — top-left */}
          <span
            data-testid="pack-tile-category"
            className="
              absolute top-2 left-2 z-[3]
              px-1.5 py-0.5 rounded-xs
              bg-base/60 border border-white/[0.08]
              backdrop-blur-[6px]
              font-mono text-[9px] tracking-[0.16em] uppercase text-warm
            "
          >
            {CATEGORY_LABEL[pack.category]}
          </span>

          {/* Price badge — top-right */}
          <span
            data-testid="pack-tile-price"
            className="
              absolute top-2 right-2 z-[3]
              px-1.5 py-0.5 rounded-xs
              bg-base/70 border border-molten/30
              backdrop-blur-[6px]
              font-mono text-[10px] tracking-[0.08em] text-molten font-semibold
            "
          >
            {pack.price_credits ?? Math.round(pack.price_cents / 10)} ⚡
          </span>

          {/* Active dot — bottom-right */}
          {active && (
            <span
              data-testid="pack-tile-active-dot"
              aria-label="Active"
              className="
                absolute bottom-2 right-2 z-[3]
                size-1.5 rounded-full bg-molten
                shadow-[0_0_10px_var(--mvfm-molten-glow)]
              "
            />
          )}

          {/* Hover play-ring */}
          <span
            data-testid="pack-tile-play-ring"
            onClick={(e) => {
              e.stopPropagation();
              onPlay?.(pack.id);
            }}
            role="button"
            aria-label={`Preview ${pack.title}`}
            tabIndex={0}
            className={cn(
              "absolute inset-0 m-auto",
              "size-11 rounded-full grid place-items-center z-[2]",
              "bg-base/50 backdrop-blur-[6px]",
              "shadow-[inset_0_0_0_1.5px_var(--mvfm-molten),0_0_22px_-4px_var(--mvfm-molten-dim)]",
              "opacity-0 group-hover:opacity-100 transition-opacity duration-tune ease-tune",
              active && "opacity-100",
            )}
          >
            <span
              className="block w-0 h-0 ml-0.5"
              aria-hidden
              style={{
                borderLeft: "9px solid var(--mvfm-molten)",
                borderTop: "6px solid transparent",
                borderBottom: "6px solid transparent",
              }}
            />
          </span>
        </div>

        {/* Meta — always visible for marketplace context (legibility > density) */}
        {size !== "sm" && (
          <div
            data-testid="pack-tile-meta"
            className="px-3 py-2.5 flex flex-col gap-0.5 bg-elev border-t border-glass-soft"
          >
            <span className="font-mono text-warm text-[12.5px] truncate">
              {pack.title}
            </span>
            <span className="font-mono text-silver2 text-[10px] tracking-[0.1em] uppercase truncate flex items-center gap-1.5">
              <span className="truncate">{pack.creator_name}</span>
              <span
                className="size-[2px] rounded-full bg-silver2/70 flex-shrink-0"
                aria-hidden
              />
              <span className="truncate">
                {sampleWord(pack.sample_count, pack.category)}
              </span>
            </span>
          </div>
        )}
      </button>
    </article>
  );
}

function sampleWord(count: number, category: PackCategory): string {
  const noun = category === "sfx" ? "sound" : "sample";
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}

/** Use the pack id as the plate seed so each card has stable, distinct art. */
function plateSeedFromPack(pack: Pack): string {
  // Honour the existing station seeds for radio_packs that map 1:1.
  if (pack.category === "radio_packs" && pack.id.startsWith("pack-radio-")) {
    return pack.id.replace(/^pack-radio-/, "");
  }
  return pack.id;
}


