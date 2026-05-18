import type { Station, Tier } from "@multiverse/shared";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { plateFor } from "@/lib/stationArt";
import { usePlayer } from "@/stores/playerStore";

export type RightPanelTab = "now-playing" | "world-data" | "export";

export interface RightPanelProps {
  station: Station;
  /** Current user tier — gates Export tab content. Defaults to free. */
  userTier?: Tier;
  initialTab?: RightPanelTab;
  onAskTheDJ?: (id: string) => void;
  onPlay?: (id: string) => void;
  onExport?: (id: string) => void;
  onClose?: () => void;
}

const TABS: ReadonlyArray<{ key: RightPanelTab; label: string }> = [
  { key: "now-playing", label: "Now playing" },
  { key: "world-data", label: "World data" },
  { key: "export", label: "Export" },
];

const SEGMENTS: ReadonlyArray<{ k: string; label: string; t: string }> = [
  { k: "tuning_lock", label: "Tuning lock", t: "0:00" },
  { k: "ident", label: "Station ident · DJ intro", t: "0:06" },
  { k: "music_a", label: "Music foreground", t: "0:20" },
  { k: "news", label: "News bulletin", t: "1:10" },
  { k: "music_b", label: "Music foreground", t: "1:35" },
  { k: "sponsor", label: "Sponsor ad", t: "2:30" },
  { k: "banter", label: "DJ banter / call-in", t: "2:50" },
  { k: "close", label: "Closing teaser", t: "3:35" },
  { k: "fade", label: "Fade · retune cue", t: "3:50" },
];

export function RightPanel({
  station,
  userTier = "free",
  initialTab = "now-playing",
  onAskTheDJ,
  onPlay,
  onExport,
  onClose,
}: RightPanelProps) {
  const [tab, setTab] = useState<RightPanelTab>(initialTab);
  const closePanel = usePlayer((s) => s.closePanel);
  const progress = usePlayer((s) => s.progress);
  const currentId = usePlayer((s) => s.currentStationId);
  const isPlaying = usePlayer((s) => s.isPlaying);

  const dismiss = () => {
    closePanel();
    onClose?.();
  };

  // Resolve "current segment" from progress (synthetic until WebAudio lands).
  const activeIdx =
    currentId === station.id && isPlaying
      ? Math.min(SEGMENTS.length - 1, Math.floor(progress * SEGMENTS.length))
      : -1;

  return (
    <div
      data-testid="right-panel"
      className="
        h-full w-full flex flex-col
        bg-elev/40 backdrop-blur-panel
      "
    >
      {/* Tabs row */}
      <div
        role="tablist"
        aria-label="Panel"
        className="
          flex items-center justify-between gap-2
          px-3 sm:px-4 h-12
          border-b border-glass-soft
        "
      >
        <div className="flex items-center gap-0.5">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              data-testid={`tab-${key}`}
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                "px-3 py-1.5 rounded-md",
                "font-mono text-[10px] tracking-[0.18em] uppercase",
                "transition-colors duration-fast ease-tune",
                tab === key
                  ? "text-warm bg-elev-2 border border-glass-soft"
                  : "text-silver hover:text-warm",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="Close panel"
          data-testid="panel-close"
          onClick={dismiss}
          className="
            size-7 rounded-md grid place-items-center
            text-silver2 hover:text-warm
            transition-colors duration-fast ease-tune
          "
        >
          <svg viewBox="0 0 12 12" fill="none" aria-hidden className="size-3">
            <path
              d="M3 3l6 6M9 3l-6 6"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === "now-playing" && (
          <NowPlaying
            station={station}
            activeIdx={activeIdx}
            onAskTheDJ={() => onAskTheDJ?.(station.id)}
            onPlay={() => onPlay?.(station.id)}
            isPlayingThis={currentId === station.id && isPlaying}
          />
        )}
        {tab === "world-data" && <WorldData station={station} />}
        {tab === "export" && (
          <ExportTab
            station={station}
            userTier={userTier}
            onExport={() => onExport?.(station.id)}
          />
        )}
      </div>
    </div>
  );
}

function NowPlaying({
  station,
  activeIdx,
  isPlayingThis,
  onAskTheDJ,
  onPlay,
}: {
  station: Station;
  activeIdx: number;
  isPlayingThis: boolean;
  onAskTheDJ: () => void;
  onPlay: () => void;
}) {
  const plate = plateFor(station.id);
  return (
    <div data-testid="rp-now-playing" className="p-4 sm:p-5 space-y-5">
      {/* DJ block */}
      <div className="flex items-start gap-3">
        <div
          aria-hidden
          className="size-14 rounded-full flex-shrink-0 relative overflow-hidden"
          style={{ background: plate.background }}
        >
          <div className="absolute inset-0 mvfm-grain opacity-60" />
        </div>
        <div className="min-w-0">
          <div className="font-mono text-silver2 text-[9px] tracking-[0.22em] uppercase">
            DJ on air
          </div>
          <div className="font-mono text-warm text-[15px] tracking-[0.01em] truncate mt-0.5">
            {station.dj_persona}
          </div>
          <div className="font-mono text-silver2 text-[10px] tracking-[0.14em] uppercase mt-0.5 truncate">
            {station.language_register}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          data-testid="rp-play"
          onClick={onPlay}
          style={{
            color: "#1a0700",
            background: "var(--mvfm-molten)",
            boxShadow:
              "0 0 0 1px rgba(255,106,31,0.7), 0 10px 30px -10px rgba(255,106,31,0.8), inset 0 1px 0 rgba(255,255,255,0.28)",
          }}
          className="
            inline-flex items-center gap-1.5 px-3 py-2 rounded-md
            font-mono text-[10px] tracking-[0.18em] uppercase font-semibold
            hover:brightness-110 transition-all duration-fast ease-tune
          "
        >
          <span
            aria-hidden
            className="block w-0 h-0 -ml-0.5"
            style={{
              borderLeft: "6px solid #1a0700",
              borderTop: "4px solid transparent",
              borderBottom: "4px solid transparent",
            }}
          />
          {isPlayingThis ? "Now playing" : "Play 4-min block"}
        </button>
        <button
          type="button"
          data-testid="rp-ask"
          onClick={onAskTheDJ}
          className="
            inline-flex items-center gap-1.5 px-3 py-2 rounded-md
            bg-elev-2/60 border border-glass-soft text-silver
            hover:text-warm hover:border-glass
            font-mono text-[10px] tracking-[0.18em] uppercase
            transition-colors duration-fast ease-tune
          "
        >
          Ask the DJ
        </button>
      </div>

      {/* Segment timeline */}
      <section data-testid="rp-segments">
        <div className="font-mono text-silver2 text-[9px] tracking-[0.22em] uppercase mb-2">
          Run sheet · 4:00 block
        </div>
        <ol className="flex flex-col gap-1">
          {SEGMENTS.map((seg, i) => {
            const active = i === activeIdx;
            return (
              <li
                key={seg.k}
                data-testid={`segment-${seg.k}`}
                data-active={active}
                className={cn(
                  "flex items-center gap-3 px-2.5 py-1.5 rounded-md",
                  "border border-transparent",
                  active &&
                    "bg-molten-tint border-molten/40 shadow-[0_0_22px_-8px_var(--mvfm-molten-dim)]",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full flex-shrink-0",
                    active ? "bg-molten" : "bg-white/15",
                  )}
                  style={
                    active
                      ? { boxShadow: "0 0 8px var(--mvfm-molten-glow)" }
                      : undefined
                  }
                />
                <span
                  className={cn(
                    "font-mono text-[10.5px] tracking-[0.02em] flex-1 truncate",
                    active ? "text-warm" : "text-silver",
                  )}
                >
                  {seg.label}
                </span>
                <span className="font-mono text-silver2 text-[9px] tracking-[0.14em] uppercase">
                  {seg.t}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Headlines (in-character) */}
      <section>
        <div className="font-mono text-silver2 text-[9px] tracking-[0.22em] uppercase mb-1.5">
          Bulletin
        </div>
        <p className="text-warm/85 text-[13px] leading-[1.5]">
          {station.headline_style}
        </p>
      </section>
    </div>
  );
}

function WorldData({ station }: { station: Station }) {
  const fields: Array<[string, string]> = [
    ["Reality type", station.reality_type.replace("_", " ")],
    ["Year / era", station.year_or_era],
    ["Place", station.place],
    ["Format", station.broadcast_format],
    ["DJ persona", station.dj_persona],
    ["Language register", station.language_register],
    ["Ad economy", station.ad_economy.join(" · ")],
    ["Headline style", station.headline_style],
    ["Weather style", station.weather_style],
    ["Ambient palette", station.ambient_palette.join(" · ")],
    ["Signal texture", station.signal_texture],
    ["Mastering preset", station.mastering_preset],
  ];
  return (
    <div data-testid="rp-world-data" className="p-4 sm:p-5">
      <div className="font-mono text-silver2 text-[9px] tracking-[0.22em] uppercase mb-3">
        Station schema
      </div>
      <dl className="grid grid-cols-1 gap-3">
        {fields.map(([k, v], i) => (
          <div key={k} className="border-b border-glass-soft pb-3 last:border-b-0">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="font-mono text-silver2 text-[9px] tracking-[0.22em] uppercase">
                {k}
              </dt>
              <span className="font-mono text-silver2 text-[8.5px] tracking-[0.22em]">
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
            <dd className="mt-1 text-warm text-[13px] leading-[1.45]">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const RANK: Record<Tier, number> = { free: 0, explorer: 1, architect: 2 };

function ExportTab({
  station,
  userTier,
  onExport,
}: {
  station: Station;
  userTier: Tier;
  onExport: () => void;
}) {
  const requiredTier: Tier =
    station.tier_required === "free" ? "explorer" : station.tier_required;
  const canExport = RANK[userTier] >= RANK[requiredTier];

  const PACK_LINES: Array<[string, string, boolean]> = [
    ["Broadcast block", "broadcast.mp3", true],
    ["Music stems", "stems/music.wav", true],
    ["Voice stems", "stems/voice_*.wav", true],
    ["Ambience stem", "stems/ambience.wav", true],
    ["Cover art", "cover.webp", true],
    ["Hero plate", "hero.webp", true],
    ["Poster", "poster.webp", true],
    ["Manifest", "manifest.json", true],
  ];

  return (
    <div data-testid="rp-export" className="p-4 sm:p-5 space-y-4">
      <div>
        <div className="font-mono text-silver2 text-[9px] tracking-[0.22em] uppercase">
          World Pack
        </div>
        <div className="font-mono text-warm text-[14px] tracking-[0.01em] mt-1 truncate">
          {station.station_name}
        </div>
      </div>

      <ul className="flex flex-col gap-0 rounded-md border border-glass-soft overflow-hidden">
        {PACK_LINES.map(([label, file]) => (
          <li
            key={label}
            className="
              flex items-center justify-between gap-3
              px-3 py-2
              border-b border-glass-soft last:border-b-0
              bg-elev-2/40
            "
          >
            <span className="font-mono text-warm text-[11px] tracking-[0.02em] truncate">
              {label}
            </span>
            <span className="font-mono text-silver2 text-[9.5px] tracking-[0.14em] uppercase truncate">
              {file}
            </span>
          </li>
        ))}
      </ul>

      {canExport ? (
        <button
          type="button"
          data-testid="rp-export-download"
          onClick={onExport}
          style={{
            color: "#1a0700",
            background: "var(--mvfm-molten)",
            boxShadow:
              "0 0 0 1px rgba(255,106,31,0.7), 0 10px 30px -10px rgba(255,106,31,0.8), inset 0 1px 0 rgba(255,255,255,0.28)",
          }}
          className="
            w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md
            font-mono text-[10.5px] tracking-[0.18em] uppercase font-semibold
            hover:brightness-110 transition-all duration-fast ease-tune
          "
        >
          Download .zip
        </button>
      ) : (
        <div
          data-testid="rp-export-paywall"
          className="
            p-3 rounded-md border border-glass-soft bg-elev-2/40
            font-mono text-[10.5px] text-silver leading-[1.5] tracking-[0.02em]
          "
        >
          <span className="text-molten uppercase tracking-[0.18em] text-[9px]">
            Signal locked
          </span>
          <div className="mt-1.5 text-warm/85">
            Export requires <b className="text-warm uppercase">{requiredTier}</b> tier.
            Tap “Upgrade” in the topbar to unlock the World Pack download.
          </div>
        </div>
      )}

      <p className="text-silver2 text-[10.5px] leading-[1.5]">
        Pro Studio bundles WAV stems + manifest. Creator tier ships MP3 + cover only.
      </p>
    </div>
  );
}
