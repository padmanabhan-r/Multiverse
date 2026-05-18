import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Pack } from "@multiverse/shared";
import { cn } from "@/lib/cn";
import { plateFor } from "@/lib/stationArt";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

function audioUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  return `${API_BASE}${u}`;
}

export interface MarketplaceHeroProps {
  pack?: Pack | null;
  loading?: boolean;
  onPreview?: (id: string) => void;
}

const CATEGORY_LABEL: Record<string, string> = {
  sfx: "Sound effects",
  music: "Music",
  voice_packs: "Voice packs",
  ambient: "Ambient",
  radio_packs: "Radio packs",
  broadcast_packs: "Broadcast packs",
};

/**
 * Cinematic hero — 60–90 dvh full-bleed with slow ken-burns on the
 * gpt-image-2 hero plate (falls back to cover, then procedural plate).
 * Massive Bricolage title overlay. Two CTAs at bottom.
 */
export function MarketplaceHero({
  pack,
  loading,
}: MarketplaceHeroProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  function togglePreview() {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else audioRef.current.play().catch(() => {/* user gesture race */});
  }

  if (loading || !pack) {
    return (
      <section
        data-testid="marketplace-hero-skeleton"
        className={cn(
          "relative w-full overflow-hidden rounded-xl",
          "h-[320px] sm:h-[400px] lg:h-[480px]",
          "bg-elev-2 animate-pulse",
        )}
      />
    );
  }

  const plate = plateFor(pack.id);
  const heroImage = pack.hero_art_url || pack.cover_art_url;
  const formattedPrice = `$${(pack.price_cents / 100).toFixed(
    pack.price_cents % 100 === 0 ? 0 : 2,
  )}`;

  return (
    <section
      data-testid="marketplace-hero"
      className={cn(
        "relative w-full overflow-hidden rounded-xl",
        "h-[320px] sm:h-[400px] lg:h-[480px]",
        "border border-glass-soft shadow-panel",
      )}
    >
      {/* Plate w/ slow ken-burns */}
      <div
        className="absolute inset-0 mvfm-animate-ken-burns"
        style={{
          background: heroImage
            ? `center / cover no-repeat url('${heroImage}'), ${plate.background}`
            : plate.background,
        }}
      />

      {/* Triple overlay: radial vignette + linear floor + film grain */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: [
            "radial-gradient(ellipse 80% 60% at 20% 100%, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 60%)",
            "linear-gradient(180deg, rgba(10,10,12,0.45) 0%, rgba(10,10,12,0) 25%, rgba(10,10,12,0) 50%, rgba(10,10,12,0.92) 100%)",
          ].join(", "),
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 mvfm-grain opacity-60 pointer-events-none"
      />

      {/* Top-left eyebrow */}
      <div className="absolute top-5 left-5 sm:top-7 sm:left-9 z-[3] flex items-center gap-2.5 font-mono text-silver2 text-[10px] tracking-[0.32em] uppercase">
        <span
          className="inline-block size-2 bg-molten"
          style={{ boxShadow: "0 0 6px var(--mvfm-molten-glow)" }}
          aria-hidden
        />
        Featured · {CATEGORY_LABEL[pack.category] ?? pack.category}
      </div>

      {/* Top-right metadata */}
      <div className="hidden sm:flex absolute top-7 right-9 z-[3] gap-3 font-mono text-silver2 text-[10px] tracking-[0.22em] uppercase">
        <span>
          By <b className="font-normal text-silver">{pack.creator_name}</b>
        </span>
        <span className="opacity-50">·</span>
        <span>
          {pack.sample_count} sample{pack.sample_count === 1 ? "" : "s"}
        </span>
      </div>

      {/* Bottom block */}
      <div className="absolute left-5 sm:left-9 lg:left-12 z-[3] bottom-9 sm:bottom-12 right-5 sm:right-9 lg:right-12 max-w-[1100px]">
        <h1
          data-testid="marketplace-hero-title"
          className="mvfm-display mvfm-display-hero text-warm mb-4"
        >
          {pack.title}
        </h1>

        {pack.description && (
          <p className="text-warm/85 text-[14px] sm:text-[16px] leading-[1.5] max-w-[560px] mb-6 font-body">
            {pack.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to={`/p/${pack.id}`}
            data-testid="marketplace-hero-open"
            style={{
              color: "#1a0700",
              background: "var(--mvfm-molten)",
              boxShadow:
                "0 0 0 1px rgba(255,106,31,0.7), 0 10px 30px -10px rgba(255,106,31,0.8), inset 0 1px 0 rgba(255,255,255,0.28)",
            }}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-md font-mono text-[11px] tracking-[0.18em] uppercase font-semibold hover:brightness-110 transition-all duration-fast ease-tune"
          >
            Open pack · {formattedPrice}
          </Link>
          <button
            type="button"
            data-testid="marketplace-hero-preview"
            onClick={togglePreview}
            className="
              inline-flex items-center gap-2 px-5 py-3 rounded-md
              text-warm font-mono text-[11px] tracking-[0.18em] uppercase font-semibold
              transition-all duration-fast ease-tune hover:brightness-110
            "
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03))",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.12), inset 0 0 0 1px rgba(255,255,255,0.08)",
            }}
          >
            {playing ? (
              <span
                aria-hidden
                className="inline-flex items-center gap-0.5"
              >
                <span
                  className="inline-block w-[3px] h-3 bg-current"
                />
                <span
                  className="inline-block w-[3px] h-3 bg-current"
                />
              </span>
            ) : (
              <span
                aria-hidden
                className="block w-0 h-0 -ml-0.5"
                style={{
                  borderLeft: "8px solid currentColor",
                  borderTop: "6px solid transparent",
                  borderBottom: "6px solid transparent",
                }}
              />
            )}
            {playing ? "Pause preview" : "Preview"}
          </button>
        </div>

        {/* Hidden audio element driven by the Preview button. */}
        {audioUrl(pack.preview_url) && (
          <audio
            ref={audioRef}
            src={audioUrl(pack.preview_url) || undefined}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            preload="none"
            data-testid="marketplace-hero-audio"
          />
        )}
      </div>

      {/* Bottom scan-line */}
      <div
        aria-hidden
        className="absolute left-0 right-0 bottom-0 mvfm-scanline"
      />
    </section>
  );
}

