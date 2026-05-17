import type { Station } from "@multiverse-fm/shared";
import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { plateFor } from "@/lib/stationArt";

export interface HeroBandProps {
  station: Pick<
    Station,
    | "id"
    | "station_name"
    | "year_or_era"
    | "place"
    | "reality_type"
    | "station_slogan"
    | "broadcast_format"
  >;
  onPlay?: (id: string) => void;
  onExport?: (id: string) => void;
  className?: string;
}

export function HeroBand({ station, onPlay, onExport, className }: HeroBandProps) {
  const plate = plateFor(station.id);
  const realityLabel = station.reality_type.replace("_", " ");
  // 32 bars in a deterministic waveform — molten with subtle ease.
  const wave = useMemo(() => buildWaveBars(station.id), [station.id]);

  return (
    <section
      data-testid="hero-band"
      className={cn(
        "relative w-full overflow-hidden",
        "h-[280px] sm:h-[340px] lg:h-[400px]",
        "border-b border-glass-soft",
        className,
      )}
    >
      {/* Plate */}
      <div
        data-testid="hero-plate"
        className="absolute inset-0"
        style={{ background: plate.background }}
      />
      {plate.accentLayer && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: plate.accentLayer }}
          aria-hidden
        />
      )}
      {/* Film grain */}
      <div className="absolute inset-0 mvfm-grain opacity-60 pointer-events-none" />
      {/* Vignette (heavy bottom + left) */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: [
            "radial-gradient(ellipse at 30% 60%, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.55) 90%, rgba(0,0,0,0.85) 100%)",
            "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 60%, rgba(10,10,12,0.85) 100%)",
          ].join(", "),
        }}
      />
      {/* Subtle dim layer for legibility */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ background: "rgba(8,9,12,0.30)" }}
      />

      {/* Top-left ID label */}
      <div
        className="
          absolute top-3 left-4 sm:top-4 sm:left-8 z-[3]
          flex items-center gap-2.5
          font-mono text-silver2 text-[9.5px] tracking-[0.22em] uppercase
        "
      >
        <span
          className="inline-block size-2 bg-molten"
          style={{ boxShadow: "0 0 5px var(--mvfm-molten-glow)" }}
          aria-hidden
        />
        Multiverse FM
        <span className="opacity-50">/</span>
        Hero · {realityLabel} · {station.year_or_era}
      </div>

      {/* Top-right meta */}
      <div
        className="
          hidden sm:flex absolute top-4 right-6 z-[3]
          font-mono text-silver2 text-[9.5px] tracking-[0.18em] uppercase
          gap-4
        "
      >
        <span>
          Format <b className="font-normal text-silver">{station.broadcast_format}</b>
        </span>
      </div>

      {/* Bottom-left overlay block */}
      <div
        className="
          absolute left-4 sm:left-8 z-[3]
          bottom-16 sm:bottom-20 max-w-[88%] sm:max-w-[560px]
        "
      >
        <div
          className="
            flex items-center gap-2.5 mb-3
            font-mono text-silver2 text-[10.5px] tracking-[0.16em] uppercase
          "
        >
          <span className="text-molten inline-flex items-center gap-1.5">
            <span
              className="size-1.5 rounded-full bg-molten"
              style={{ boxShadow: "0 0 8px var(--mvfm-molten-glow)" }}
              aria-hidden
            />
            On air
          </span>
          <span className="size-0.5 rounded-full bg-silver2/60" aria-hidden />
          <span>Hero world</span>
          <span className="size-0.5 rounded-full bg-silver2/60" aria-hidden />
          <span>{realityLabel}</span>
          <span className="size-0.5 rounded-full bg-silver2/60" aria-hidden />
          <span>{station.place}</span>
        </div>

        <h1
          data-testid="hero-title"
          className="
            font-mono font-semibold text-warm
            text-[36px] sm:text-[52px] lg:text-[64px]
            leading-[0.95] tracking-[-0.01em] mb-3
          "
          style={{ fontFeatureSettings: '"ss01","ss02"' }}
        >
          {station.station_name}
        </h1>

        <p
          data-testid="hero-quote"
          className="
            font-body italic text-warm/80
            text-[13px] sm:text-[15px] lg:text-[16px] leading-[1.45]
            max-w-[440px] mb-5 text-balance
          "
        >
          “{station.station_slogan}”
        </p>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            data-testid="hero-play"
            onClick={() => onPlay?.(station.id)}
            style={{
              color: "#1a0700",
              background: "var(--mvfm-molten)",
              boxShadow:
                "0 0 0 1px rgba(255,106,31,0.7), 0 10px 30px -10px rgba(255,106,31,0.8), inset 0 1px 0 rgba(255,255,255,0.28)",
            }}
            className="
              inline-flex items-center gap-2
              px-3.5 sm:px-4.5 py-2.5 sm:py-3 rounded-md
              font-mono text-[10.5px] sm:text-[11px] tracking-[0.12em] uppercase font-semibold
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
            Play world
          </button>
          <button
            type="button"
            data-testid="hero-export"
            onClick={() => onExport?.(station.id)}
            className="
              inline-flex items-center gap-2
              px-3 sm:px-4.5 py-2.5 sm:py-3 rounded-md
              text-warm font-mono text-[10.5px] sm:text-[11px] tracking-[0.12em] uppercase font-semibold
              backdrop-blur-panel
              transition-all duration-fast ease-tune
              hover:brightness-110
            "
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03))",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.12), inset 0 0 0 1px rgba(255,255,255,0.08), 0 10px 24px -14px rgba(0,0,0,0.6)",
            }}
          >
            <ExportIcon />
            <span className="hidden sm:inline">Export world pack</span>
            <span className="sm:hidden">Export</span>
          </button>
        </div>
      </div>

      {/* Waveform strip — bottom edge */}
      <div
        aria-hidden
        data-testid="hero-wave"
        className="
          absolute left-0 right-0 bottom-0 z-[3]
          h-10 flex items-end justify-start
          gap-[2px] px-4 sm:px-8 pb-3 overflow-hidden
        "
        style={{
          maskImage:
            "linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 6%, rgba(0,0,0,1) 94%, rgba(0,0,0,0) 100%)",
          WebkitMaskImage:
            "linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 6%, rgba(0,0,0,1) 94%, rgba(0,0,0,0) 100%)",
        }}
      >
        {wave.map((h, i) => (
          <span
            key={i}
            className="rounded-sm bg-molten"
            style={{
              width: 2.5,
              height: h,
              filter: "drop-shadow(0 0 3px rgba(255,138,61,0.55))",
              opacity: 0.85,
            }}
          />
        ))}
      </div>
    </section>
  );
}

function ExportIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="none" aria-hidden className="size-3">
      <path
        d="M6 1.5v6m0 0L3.5 5M6 7.5L8.5 5M2 9.5h8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Deterministic bar heights — same station = same wave shape. */
function buildWaveBars(seed: string): number[] {
  const bars: number[] = [];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 33 + seed.charCodeAt(i)) >>> 0;
  for (let i = 0; i < 96; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    const norm = (h % 1000) / 1000;
    // Bias toward mid-range for a denser look
    const height = 6 + norm * 22;
    bars.push(Math.round(height));
  }
  return bars;
}
