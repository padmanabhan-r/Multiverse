import type { Station } from "@multiverse-fm/shared";
import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { plateFor } from "@/lib/stationArt";
import { usePlayer } from "@/stores/playerStore";

export interface BottomPlayerProps {
  station: Pick<
    Station,
    "id" | "station_name" | "year_or_era" | "dj_persona" | "place"
  >;
  onAskTheDJ?: (id: string) => void;
  onExport?: (id: string) => void;
}

export function BottomPlayer({ station, onAskTheDJ, onExport }: BottomPlayerProps) {
  const isPlaying = usePlayer((s) => s.isPlaying);
  const progress = usePlayer((s) => s.progress);
  const toggle = usePlayer((s) => s.toggle);
  const stop = usePlayer((s) => s.stop);

  const plate = plateFor(station.id);
  const wave = useMemo(() => buildWave(station.id), [station.id]);

  return (
    <div
      data-testid="bottom-player-content"
      data-playing={isPlaying}
      className="
        h-full w-full grid items-center
        grid-cols-[auto_1fr_auto]
        gap-4 sm:gap-6 px-3 sm:px-5
      "
    >
      {/* LEFT — cover thumb + dial + meta */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Cover thumb 44×44 */}
        <div
          data-testid="player-cover"
          className="size-11 rounded-md overflow-hidden flex-shrink-0 relative"
          style={{ background: plate.background }}
        >
          <div className="absolute inset-0 mvfm-grain opacity-60 pointer-events-none" />
        </div>

        {/* 48 px tuning-dial primitive — signature identity widget */}
        <Dial48 active={isPlaying} />

        {/* Title + DJ */}
        <div className="min-w-0 hidden xs:block sm:block">
          <div className="font-mono text-warm text-[12px] tracking-[0.02em] truncate">
            {station.station_name}
          </div>
          <div className="font-mono text-silver2 text-[9.5px] tracking-[0.18em] uppercase truncate">
            {station.dj_persona}
          </div>
        </div>
      </div>

      {/* CENTER — waveform + scrubber */}
      <div className="hidden sm:flex flex-col gap-1 min-w-0 px-2">
        <div
          data-testid="player-wave"
          aria-hidden
          className="h-7 flex items-end gap-[2px] overflow-hidden"
        >
          {wave.map((h, i) => {
            const reached = i / wave.length <= progress;
            return (
              <span
                key={i}
                className={cn(
                  "rounded-[1.5px] flex-shrink-0",
                  reached ? "bg-molten" : "bg-white/15",
                )}
                style={{
                  width: 2,
                  height: h,
                  filter: reached
                    ? "drop-shadow(0 0 3px rgba(255,138,61,0.55))"
                    : undefined,
                }}
              />
            );
          })}
        </div>
        <div className="flex items-center justify-between font-mono text-silver2 text-[9px] tracking-[0.14em] uppercase">
          <span>{fmtTime(progress * 240)}</span>
          <span>4:00</span>
        </div>
      </div>

      {/* RIGHT — transport + ask-the-dj + export */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
        <button
          type="button"
          aria-label={isPlaying ? "Pause" : "Play"}
          data-testid="player-toggle"
          onClick={toggle}
          style={isPlaying ? { color: "#1a0700" } : undefined}
          className={cn(
            "size-9 rounded-pill grid place-items-center",
            "transition-all duration-fast ease-tune",
            isPlaying
              ? "bg-molten hover:bg-molten-glow shadow-bloom"
              : "bg-elev-2/60 border border-glass-soft text-silver hover:text-warm",
          )}
        >
          {isPlaying ? <PauseGlyph /> : <PlayGlyph />}
        </button>

        <button
          type="button"
          aria-label="Ask the DJ"
          data-testid="player-ask-dj"
          onClick={() => onAskTheDJ?.(station.id)}
          className="
            hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-md
            bg-elev-2/60 border border-glass-soft
            font-mono text-[10px] tracking-[0.22em] uppercase
            text-silver hover:text-warm hover:border-glass
            transition-colors duration-fast ease-tune
          "
        >
          <DjGlyph />
          <span className="hidden lg:inline">Ask the DJ</span>
        </button>

        <button
          type="button"
          aria-label="Export world pack"
          data-testid="player-export"
          onClick={() => onExport?.(station.id)}
          className="
            size-9 rounded-md grid place-items-center
            bg-elev-2/60 border border-glass-soft
            text-silver hover:text-warm hover:border-glass
            transition-colors duration-fast ease-tune
          "
        >
          <ExportGlyph />
        </button>

        <button
          type="button"
          aria-label="Stop and dismiss player"
          data-testid="player-close"
          onClick={stop}
          className="
            size-9 rounded-md grid place-items-center
            text-silver2 hover:text-warm
            transition-colors duration-fast ease-tune
          "
        >
          <CloseGlyph />
        </button>
      </div>
    </div>
  );
}

function Dial48({ active }: { active: boolean }) {
  return (
    <div
      data-testid="player-dial"
      data-active={active}
      className="size-12 rounded-full flex-shrink-0 relative grid place-items-center"
      style={{
        background:
          "radial-gradient(circle at 50% 35%, #2a2c33 0%, #16171c 60%, #0a0b0f 100%)",
        boxShadow: "var(--mvfm-shadow-dial)",
      }}
      aria-label="Tuning dial"
    >
      {/* Inner disc */}
      <div
        className="size-7 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 50% 30%, #1c1d22, #0d0e12 70%)",
        }}
      />
      {/* Molten lock ring */}
      <div
        aria-hidden
        className="absolute inset-1 rounded-full pointer-events-none transition-opacity duration-tune"
        style={{
          boxShadow: active
            ? "inset 0 0 0 1px rgba(255,106,31,0.7), 0 0 14px 1px rgba(255,106,31,0.32)"
            : "inset 0 0 0 1px rgba(255,106,31,0.15)",
        }}
      />
      {/* Needle */}
      <span
        aria-hidden
        className="absolute left-1/2 top-1.5 origin-bottom"
        style={{
          width: 1.5,
          height: 18,
          marginLeft: -0.75,
          transform: active ? "rotate(-18deg)" : "rotate(-42deg)",
          transition: "transform var(--mvfm-dur-slow) var(--mvfm-ease)",
          background:
            "linear-gradient(180deg, rgba(255,106,31,0) 0%, var(--mvfm-molten-glow) 60%, var(--mvfm-molten) 100%)",
          filter: active ? "drop-shadow(0 0 4px rgba(255,106,31,0.65))" : "none",
        }}
      />
    </div>
  );
}

function PlayGlyph() {
  return (
    <span
      aria-hidden
      className="block w-0 h-0 ml-0.5"
      style={{
        borderLeft: "7px solid currentColor",
        borderTop: "5px solid transparent",
        borderBottom: "5px solid transparent",
      }}
    />
  );
}
function PauseGlyph() {
  return (
    <span aria-hidden className="flex items-center gap-[3px]">
      <span className="block w-[3px] h-2.5 bg-current rounded-[1px]" />
      <span className="block w-[3px] h-2.5 bg-current rounded-[1px]" />
    </span>
  );
}
function ExportGlyph() {
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
function DjGlyph() {
  return (
    <svg viewBox="0 0 12 12" fill="none" aria-hidden className="size-3">
      <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M2.5 10c.5-1.5 1.8-2.5 3.5-2.5s3 1 3.5 2.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
function CloseGlyph() {
  return (
    <svg viewBox="0 0 12 12" fill="none" aria-hidden className="size-3">
      <path
        d="M3 3l6 6M9 3l-6 6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function buildWave(seed: string): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 33 + seed.charCodeAt(i)) >>> 0;
  const bars: number[] = [];
  for (let i = 0; i < 80; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    bars.push(4 + Math.round((h % 1000) / 1000 * 18));
  }
  return bars;
}

function fmtTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
