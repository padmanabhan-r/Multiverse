import type { Station } from "@multiverse/shared";
import { cn } from "@/lib/cn";
import { plateFor } from "@/lib/stationArt";

export type CoverTileSize = "lg" | "md" | "sm";

export interface CoverTileProps {
  station: Pick<
    Station,
    "id" | "station_name" | "year_or_era" | "place" | "broadcast_format" | "tier_required"
  >;
  size?: CoverTileSize;
  /** Persistent active state — shows molten dot + ring */
  active?: boolean;
  /** Show creator chip in top-left (used by "Recently created" shelf) */
  creator?: boolean;
  onSelect?: (id: string) => void;
  onPlay?: (id: string) => void;
}

const SIZE_PX: Record<CoverTileSize, number> = { lg: 200, md: 160, sm: 96 };

export function CoverTile({
  station,
  size = "lg",
  active = false,
  creator = false,
  onSelect,
  onPlay,
}: CoverTileProps) {
  const px = SIZE_PX[size];
  const plate = plateFor(station.id);
  // Frequency-ident: derive a fake "FM" string from station name if numeric.
  const freqMatch = station.station_name.match(/(\d+\.?\d*)/);
  const freq = freqMatch ? freqMatch[1] : station.year_or_era;
  const freqUnit = freqMatch ? "FM" : "ERA";

  return (
    <article
      data-testid={`cover-tile-${station.id}`}
      data-active={active}
      data-size={size}
      className={cn(
        "group relative flex-shrink-0 snap-start rounded-md overflow-hidden",
        "bg-elev-2 shadow-[inset_0_0_0_1px_var(--mvfm-border-soft)]",
        "transition-transform duration-tune ease-tune",
        "hover:-translate-y-0.5",
        // active ring (persistent)
        active &&
          "shadow-[inset_0_0_0_1.5px_var(--mvfm-molten),0_0_28px_-6px_var(--mvfm-molten-dim)]",
      )}
      style={{ width: px }}
    >
      <button
        type="button"
        onClick={() => onSelect?.(station.id)}
        aria-label={`Open ${station.station_name}`}
        className="block w-full text-left"
      >
        {/* Cover plate — generated radial gradient palette */}
        <div
          data-testid="cover-plate"
          className="relative w-full overflow-hidden"
          style={{ height: px, background: plate.background }}
        >
          {plate.accentLayer && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: plate.accentLayer }}
              aria-hidden
            />
          )}
          {/* film-grain texture */}
          <div className="absolute inset-0 mvfm-grain opacity-60 pointer-events-none" />
          {/* vignette */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)",
            }}
          />

          {/* Creator chip — optional */}
          {creator && (
            <span
              className="
                absolute top-2 left-2 z-[3]
                flex items-center gap-1.5
                px-1.5 py-0.5 rounded-xs
                bg-base/60 border border-white/[0.08]
                backdrop-blur-[6px]
                font-mono text-[9px] tracking-[0.14em] uppercase text-warm
              "
            >
              <span className="size-1 rounded-full bg-molten" aria-hidden />
              Creator
            </span>
          )}

          {/* Active dot — top-right, persistent */}
          {active && (
            <span
              data-testid="active-dot"
              aria-label="Active"
              className="
                absolute top-2 right-2 z-[3]
                size-1.5 rounded-full bg-molten
                shadow-[0_0_10px_var(--mvfm-molten-glow)]
              "
            />
          )}

          {/* Bottom ident — freq + year, kept on every size */}
          <div className="absolute left-2.5 bottom-2 right-2.5 z-[2] flex items-end justify-between gap-2">
            <div className="font-mono text-warm leading-[1.05]">
              <div
                className="font-semibold tracking-[0.08em]"
                style={{
                  fontSize: size === "sm" ? "9px" : "10.5px",
                  textShadow: "0 1px 6px rgba(0,0,0,0.75)",
                }}
              >
                {freq}
                <small
                  className="block font-normal text-silver"
                  style={{
                    fontSize: "8px",
                    letterSpacing: "0.16em",
                  }}
                >
                  {freqUnit}
                </small>
              </div>
              {size !== "sm" && null}
            </div>
            <span
              className="font-mono text-silver rounded-xs px-1.5 py-0.5 backdrop-blur-[4px]"
              style={{
                fontSize: "8.5px",
                letterSpacing: "0.14em",
                background: "rgba(0,0,0,0.45)",
              }}
            >
              {station.year_or_era}
            </span>
          </div>

          {/* Hover play-ring (or persistent when active) */}
          <span
            data-testid="play-ring"
            onClick={(e) => {
              e.stopPropagation();
              onPlay?.(station.id);
            }}
            role="button"
            aria-label={`Play ${station.station_name}`}
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

        {/* Meta — hidden by default, fades in on hover. Active state keeps visible. */}
        {size !== "sm" && (
          <div
            data-testid="tile-meta"
            className={cn(
              "px-3 py-2.5 flex flex-col gap-0.5 bg-elev border-t border-glass-soft",
              "opacity-0 max-h-0 overflow-hidden",
              "transition-all duration-tune ease-tune",
              "group-hover:opacity-100 group-hover:max-h-20",
              active && "opacity-100 max-h-20",
            )}
          >
            <span className="font-mono text-warm text-[12.5px] truncate">
              {station.station_name}
            </span>
            <span className="font-mono text-silver2 text-[10px] tracking-[0.1em] uppercase truncate flex items-center gap-1.5">
              <span className="truncate">{station.place}</span>
              <span className="size-[2px] rounded-full bg-silver2/70 flex-shrink-0" aria-hidden />
              <span className="truncate">{station.broadcast_format}</span>
            </span>
          </div>
        )}
      </button>
    </article>
  );
}
