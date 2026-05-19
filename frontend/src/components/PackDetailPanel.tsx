import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { playExclusive, clearCurrent } from "@/lib/audioSingleton";
import type { Pack, PackSample } from "@multiverse/shared";
import { cn } from "@/lib/cn";
import { plateFor } from "@/lib/stationArt";
import { useCart } from "@/stores/cartStore";
import { usePlayer } from "@/stores/playerStore";
import { usePackSamples } from "@/lib/queries";

export type PackPanelTab = "preview" | "details";

export interface PackDetailPanelProps {
  pack: Pack;
  initialTab?: PackPanelTab;
  onPreview?: (id: string) => void;
}

const TABS: ReadonlyArray<{ key: PackPanelTab; label: string }> = [
  { key: "preview", label: "Preview" },
  { key: "details", label: "Details" },
];

export function PackDetailPanel({
  pack,
  initialTab = "preview",
  onPreview,
}: PackDetailPanelProps) {
  const [tab, setTab] = useState<PackPanelTab>(initialTab);
  const closePackPanel = usePlayer((s) => s.closePackPanel);
  const navigate = useNavigate();
  const { user } = useUser();

  const addItem = useCart((s) => s.add);
  const removeItem = useCart((s) => s.remove);
  const inCart = useCart((s) => s.items.some((i) => i.pack_id === pack.id));
  const isOwner = !!user && user.id === pack.creator_id;

  const dismiss = () => closePackPanel();

  return (
    <div
      data-testid="pack-detail-panel"
      className="h-full w-full flex flex-col bg-elev/40 backdrop-blur-panel"
    >
      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Pack detail"
        className="flex items-center justify-between gap-2 px-3 sm:px-4 h-12 border-b border-glass-soft"
      >
        <div className="flex items-center gap-0.5">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              data-testid={`pack-tab-${key}`}
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
          data-testid="pack-panel-close"
          onClick={dismiss}
          className="size-7 rounded-md grid place-items-center text-silver2 hover:text-warm transition-colors duration-fast ease-tune"
        >
          <svg viewBox="0 0 12 12" fill="none" className="size-3">
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
        {tab === "preview" && (
          <PreviewTab
            pack={pack}
            onPreview={onPreview}
            isOwner={isOwner}
            inCart={inCart}
            onAddToCart={() => addItem(pack, "personal")}
            onRemoveFromCart={() => removeItem(pack.id, "personal")}
            onOpenCart={() => {
              dismiss();
              navigate("/cart");
            }}
          />
        )}
        {tab === "details" && <DetailsTab pack={pack} />}
      </div>
    </div>
  );
}

function SoundRow({ sample, index }: { sample: PackSample; index: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      playExclusive(el);
    }
  }

  const src = sample.audio_url.startsWith("http")
    ? sample.audio_url
    : `${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"}${sample.audio_url}`;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-md",
        "border border-glass-soft bg-elev-2/30",
        "transition-colors duration-fast ease-tune",
        playing && "border-molten/40 bg-molten-tint/20",
      )}
    >
      <button
        type="button"
        aria-label={playing ? `Pause ${sample.title}` : `Play ${sample.title}`}
        onClick={toggle}
        className={cn(
          "flex-shrink-0 size-7 rounded-full grid place-items-center",
          "transition-colors duration-fast ease-tune",
          playing
            ? "bg-molten text-[#1a0700]"
            : "bg-elev-2 border border-glass text-silver hover:text-warm hover:border-molten/40",
        )}
      >
        {playing ? (
          <span className="flex gap-[3px]">
            <span className="w-[2.5px] h-2.5 rounded-full bg-current" />
            <span className="w-[2.5px] h-2.5 rounded-full bg-current" />
          </span>
        ) : (
          <span
            className="block w-0 h-0 ml-0.5"
            style={{
              borderLeft: "6px solid currentColor",
              borderTop: "4px solid transparent",
              borderBottom: "4px solid transparent",
            }}
          />
        )}
      </button>

      <span className="font-mono text-silver2 text-[9px] tracking-[0.18em] w-4 flex-shrink-0">
        {String(index + 1).padStart(2, "0")}
      </span>

      <span className="font-mono text-warm text-[11.5px] truncate flex-1">
        {sample.title}
      </span>

      <span className="font-mono text-silver2 text-[9px] tracking-[0.1em] flex-shrink-0">
        {formatDuration(sample.duration_ms)}
      </span>

      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => { setPlaying(false); clearCurrent(audioRef.current!); }}
        onEnded={() => { setPlaying(false); clearCurrent(audioRef.current!); }}
      />
    </div>
  );
}

function PreviewTab({
  pack,
  onPreview,
  isOwner,
  inCart,
  onAddToCart,
  onRemoveFromCart,
  onOpenCart,
}: {
  pack: Pack;
  onPreview?: (id: string) => void;
  isOwner: boolean;
  inCart: boolean;
  onAddToCart: () => void;
  onRemoveFromCart: () => void;
  onOpenCart: () => void;
}) {
  const plate = plateFor(pack.id);
  const { data: samples, isLoading: samplesLoading } = usePackSamples(pack.id);
  const totalMs = samples?.length
    ? samples.reduce((sum, s) => sum + s.duration_ms, 0)
    : pack.duration_ms;
  const trackCount = samples?.length ?? pack.sample_count;

  return (
    <div data-testid="pack-preview-tab" className="p-4 sm:p-5 space-y-5">
      <div className="relative aspect-square rounded-md overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: pack.cover_art_url
              ? `center / cover no-repeat url('${pack.cover_art_url}'), ${plate.background}`
              : plate.background,
          }}
        />
        <div className="absolute inset-0 mvfm-grain opacity-60 pointer-events-none" />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(0,0,0,0) 50%, rgba(0,0,0,0.6) 100%)",
          }}
        />
      </div>

      <div>
        <div className="font-mono text-silver2 text-[9px] tracking-[0.22em] uppercase">
          Now previewing
        </div>
        <div className="font-mono text-warm text-[15px] truncate mt-0.5">
          {pack.title}
        </div>
        <div className="font-mono text-silver2 text-[10px] tracking-[0.14em] uppercase mt-0.5">
          {sampleWord(trackCount, pack.category)} ·{" "}
          {formatDuration(totalMs)}
        </div>
      </div>

      {/* Sounds list */}
      {samplesLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 rounded-md bg-elev-2/40 animate-pulse" />
          ))}
        </div>
      ) : samples && samples.length > 0 ? (
        <div data-testid="pack-sounds-list" className="space-y-1.5">
          <div className="font-mono text-silver2 text-[9px] tracking-[0.22em] uppercase mb-2">
            Sounds
          </div>
          {samples.map((s, i) => (
            <SoundRow key={s.id} sample={s} index={i} />
          ))}
        </div>
      ) : pack.preview_url ? (
        <audio
          data-testid="pack-preview-play"
          src={
            pack.preview_url.startsWith("http")
              ? pack.preview_url
              : `${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"}${pack.preview_url}`
          }
          controls
          preload="none"
          onPlay={() => onPreview?.(pack.id)}
          className="w-full h-10"
        />
      ) : (
        <div
          data-testid="pack-preview-empty"
          className="
            w-full px-3 py-2.5 rounded-md text-silver italic text-[12px]
            bg-elev-2/40 border border-glass-soft text-center
          "
        >
          No preview available yet.
        </div>
      )}

      {pack.description && (
        <p className="text-warm/85 text-[13px] leading-[1.5]">{pack.description}</p>
      )}

      {isOwner ? (
        <div className="px-3 py-2 rounded-md bg-elev-2/40 border border-glass-soft text-center font-mono text-silver2 text-[10px] tracking-[0.18em] uppercase">
          Your pack
        </div>
      ) : inCart ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            data-testid="pack-open-cart"
            onClick={onOpenCart}
            style={{
              color: "#1a0700",
              background: "var(--mvfm-molten)",
              boxShadow:
                "0 0 0 1px rgba(255,106,31,0.7), 0 10px 30px -10px rgba(255,106,31,0.8), inset 0 1px 0 rgba(255,255,255,0.28)",
            }}
            className="
              w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-md
              font-mono text-[10.5px] tracking-[0.18em] uppercase font-semibold
              hover:brightness-110 transition-all duration-fast ease-tune
            "
          >
            View cart
          </button>
          <button
            type="button"
            data-testid="pack-remove-from-cart"
            onClick={onRemoveFromCart}
            className="
              w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md
              text-silver hover:text-warm bg-elev-2/40 border border-glass-soft hover:border-glass
              font-mono text-[10px] tracking-[0.18em] uppercase
              transition-colors duration-fast ease-tune
            "
          >
            Remove from cart
          </button>
        </div>
      ) : (
        <button
          type="button"
          data-testid="pack-add-to-cart"
          onClick={onAddToCart}
          style={{
            color: "#1a0700",
            background: "var(--mvfm-molten)",
            boxShadow:
              "0 0 0 1px rgba(255,106,31,0.7), 0 10px 30px -10px rgba(255,106,31,0.8), inset 0 1px 0 rgba(255,255,255,0.28)",
          }}
          className="
            w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-md
            font-mono text-[10.5px] tracking-[0.18em] uppercase font-semibold
            hover:brightness-110 transition-all duration-fast ease-tune
          "
        >
          Add to cart · {pack.price_credits ?? Math.round(pack.price_cents / 10)} ⚡
        </button>
      )}
    </div>
  );
}

function DetailsTab({ pack }: { pack: Pack }) {
  const { data: samples } = usePackSamples(pack.id);
  const totalMs = samples?.length
    ? samples.reduce((sum, s) => sum + s.duration_ms, 0)
    : pack.duration_ms;
  const trackCount = samples?.length ?? pack.sample_count;

  const fields: Array<[string, string]> = [
    ["Category", CATEGORY_LABEL[pack.category]],
    [pack.category === "sfx" ? "Sounds" : "Samples", String(trackCount)],
    ["Duration", formatDuration(totalMs)],
    ["Tags", (pack.tags || []).join(" · ") || "—"],
    ["Moods", (pack.moods || []).join(" · ") || "—"],
    ["Creator", pack.creator_name],
    [
      "Published",
      pack.published_at ? new Date(pack.published_at).toLocaleDateString() : "—",
    ],
  ];

  return (
    <div data-testid="pack-details-tab" className="p-4 sm:p-5">
      <div className="font-mono text-silver2 text-[9px] tracking-[0.22em] uppercase mb-3">
        About this pack
      </div>
      <dl className="grid grid-cols-1 gap-3">
        {fields.map(([k, v], i) => (
          <div
            key={k}
            className="border-b border-glass-soft pb-3 last:border-b-0"
          >
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

const CATEGORY_LABEL = {
  sfx: "Sound effects",
  music: "Music",
  voice_packs: "Voice packs",
  ambient: "Ambient",
  radio_packs: "Radio packs",
  broadcast_packs: "Broadcast packs",
} as const;

function sampleWord(count: number, category: Pack["category"]): string {
  const noun = category === "sfx" ? "sound" : "sample";
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
