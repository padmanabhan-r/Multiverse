import { useNavigate } from "react-router-dom";
import type { Station } from "@multiverse-fm/shared";
import { cn } from "@/lib/cn";
import { plateFor } from "@/lib/stationArt";

export interface StudioRevealProps {
  station: Station;
  onPlay?: (id: string) => void;
  onSave?: (id: string) => void;
}

export function StudioReveal({ station, onPlay, onSave }: StudioRevealProps) {
  const navigate = useNavigate();
  const plate = plateFor(station.id);
  const realityLabel = station.reality_type.replace("_", " ");

  return (
    <div
      data-testid="studio-reveal"
      className="flex flex-col items-center text-center gap-6 py-8 sm:py-10"
    >
      <div className="font-mono text-molten text-[10px] tracking-[0.32em] uppercase">
        Signal locked
      </div>

      <article
        className={cn(
          "relative rounded-xl overflow-hidden",
          "shadow-[inset_0_0_0_1.5px_var(--mvfm-molten),0_0_60px_-8px_var(--mvfm-molten-dim)]",
        )}
        style={{ width: 340, maxWidth: "calc(100vw - 48px)" }}
      >
        <div
          data-testid="studio-reveal-plate"
          className="relative w-full"
          style={{ height: 340, maxHeight: "calc(100vw - 48px)", background: plate.background }}
        >
          {plate.accentLayer && (
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
                "radial-gradient(ellipse at center, rgba(0,0,0,0) 50%, rgba(0,0,0,0.65) 100%)",
            }}
          />
          {/* Top-left badge */}
          <div className="absolute top-3 left-3 font-mono text-silver2 text-[9px] tracking-[0.22em] uppercase">
            New world
          </div>
          {/* Bottom title */}
          <div className="absolute left-4 right-4 bottom-4 text-left">
            <div className="font-mono text-silver2 text-[9.5px] tracking-[0.18em] uppercase mb-1">
              {realityLabel} · {station.year_or_era}
            </div>
            <div className="font-mono text-warm text-[18px] tracking-[-0.005em] truncate">
              {station.station_name}
            </div>
          </div>
        </div>
      </article>

      <p className="text-warm/85 text-[14px] italic max-w-md text-balance">
        “{station.station_slogan}”
      </p>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          data-testid="studio-reveal-play"
          onClick={() => onPlay?.(station.id)}
          style={{
            color: "#1a0700",
            background: "var(--mvfm-molten)",
            boxShadow:
              "0 0 0 1px rgba(255,106,31,0.7), 0 10px 30px -10px rgba(255,106,31,0.8), inset 0 1px 0 rgba(255,255,255,0.28)",
          }}
          className="
            inline-flex items-center gap-2 px-4 py-2.5 rounded-md
            font-mono text-[10.5px] tracking-[0.18em] uppercase font-semibold
            hover:brightness-110 transition-all duration-fast ease-tune
          "
        >
          <span
            aria-hidden
            className="block w-0 h-0 -ml-0.5"
            style={{
              borderLeft: "7px solid #1a0700",
              borderTop: "5px solid transparent",
              borderBottom: "5px solid transparent",
            }}
          />
          Play 4-min block
        </button>
        <button
          type="button"
          data-testid="studio-reveal-save"
          onClick={() => onSave?.(station.id)}
          className="
            inline-flex items-center gap-2 px-4 py-2.5 rounded-md
            text-warm font-mono text-[10.5px] tracking-[0.18em] uppercase font-semibold
            transition-all duration-fast ease-tune hover:brightness-110
          "
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03))",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.12), inset 0 0 0 1px rgba(255,255,255,0.08)",
          }}
        >
          Save to Library
        </button>
        <button
          type="button"
          data-testid="studio-reveal-publish"
          onClick={() =>
            navigate("/studio/publish", {
              state: {
                title: station.station_name,
                category: "radio_packs",
                description: station.station_slogan,
              },
            })
          }
          className="
            inline-flex items-center gap-2 px-4 py-2.5 rounded-md
            text-silver font-mono text-[10.5px] tracking-[0.18em] uppercase font-semibold
            border border-glass-soft hover:text-warm hover:border-glass
            transition-colors duration-fast ease-tune
          "
        >
          Publish to marketplace →
        </button>
      </div>
    </div>
  );
}
