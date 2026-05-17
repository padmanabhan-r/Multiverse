import { Link } from "react-router-dom";
import type { Pack } from "@multiverse-fm/shared";
import { cn } from "@/lib/cn";
import { plateFor } from "@/lib/stationArt";

export interface MarketplaceHeroProps {
  pack?: Pack | null;
  loading?: boolean;
  onPreview?: (id: string) => void;
}

const CATEGORY_LABEL = {
  sfx: "Sound effects",
  music: "Music",
  voice_packs: "Voice packs",
  ambient: "Ambient",
  radio_packs: "Radio packs",
  broadcast_packs: "Broadcast packs",
} as const;

export function MarketplaceHero({ pack, loading, onPreview }: MarketplaceHeroProps) {
  if (loading || !pack) {
    return (
      <section
        data-testid="marketplace-hero-skeleton"
        className={cn(
          "relative w-full overflow-hidden rounded-xl",
          "h-[280px] sm:h-[340px] lg:h-[380px]",
          "bg-elev-2 animate-pulse",
        )}
      />
    );
  }

  const plate = plateFor(pack.id);
  const formattedPrice = `$${(pack.price_cents / 100).toFixed(
    pack.price_cents % 100 === 0 ? 0 : 2,
  )}`;

  return (
    <section
      data-testid="marketplace-hero"
      className={cn(
        "relative w-full overflow-hidden rounded-xl",
        "h-[300px] sm:h-[360px] lg:h-[420px]",
        "border border-glass-soft",
      )}
    >
      {/* Plate */}
      <div
        className="absolute inset-0"
        style={{
          background: pack.cover_art_url
            ? `center / cover no-repeat url('${pack.cover_art_url}'), ${plate.background}`
            : plate.background,
        }}
      />
      <div aria-hidden className="absolute inset-0 mvfm-grain opacity-60 pointer-events-none" />
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: [
            "radial-gradient(ellipse at 30% 60%, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.55) 90%, rgba(0,0,0,0.85) 100%)",
            "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 50%, rgba(10,10,12,0.85) 100%)",
          ].join(", "),
        }}
      />

      {/* Top-left badge */}
      <div className="absolute top-3 left-4 sm:top-4 sm:left-6 z-[3] flex items-center gap-2.5 font-mono text-silver2 text-[9.5px] tracking-[0.22em] uppercase">
        <span
          className="inline-block size-2 bg-molten"
          style={{ boxShadow: "0 0 5px var(--mvfm-molten-glow)" }}
          aria-hidden
        />
        Featured pack
        <span className="opacity-50">/</span>
        {CATEGORY_LABEL[pack.category]}
      </div>

      {/* Top-right price + creator */}
      <div className="hidden sm:flex absolute top-4 right-6 z-[3] gap-3 font-mono text-silver2 text-[9.5px] tracking-[0.18em] uppercase">
        <span>
          Creator <b className="font-normal text-silver">{shortCreator(pack.creator_id)}</b>
        </span>
        <span className="opacity-50">·</span>
        <span>
          Price <b className="font-normal text-molten">{formattedPrice}</b>
        </span>
      </div>

      {/* Bottom overlay */}
      <div
        className="
          absolute left-4 sm:left-6 lg:left-10 z-[3]
          bottom-5 sm:bottom-8 max-w-[88%] sm:max-w-[640px]
        "
      >
        <div className="flex items-center gap-2.5 mb-3 font-mono text-silver2 text-[10px] tracking-[0.16em] uppercase">
          <span>{pack.sample_count} samples</span>
          <span className="size-0.5 rounded-full bg-silver2/60" aria-hidden />
          <span>{formatDuration(pack.duration_ms)}</span>
          <span className="size-0.5 rounded-full bg-silver2/60" aria-hidden />
          <span>Personal + commercial license</span>
        </div>

        <h1
          data-testid="marketplace-hero-title"
          className="font-mono font-semibold text-warm text-[28px] sm:text-[40px] lg:text-[52px] leading-[0.98] tracking-[-0.01em] mb-3"
          style={{ fontFeatureSettings: '"ss01","ss02"' }}
        >
          {pack.title}
        </h1>

        {pack.description && (
          <p className="text-warm/85 text-[13px] sm:text-[15px] leading-[1.45] max-w-[480px] mb-4">
            {pack.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/p/${pack.id}`}
            data-testid="marketplace-hero-open"
            style={{
              color: "#1a0700",
              background: "var(--mvfm-molten)",
              boxShadow:
                "0 0 0 1px rgba(255,106,31,0.7), 0 10px 30px -10px rgba(255,106,31,0.8), inset 0 1px 0 rgba(255,255,255,0.28)",
            }}
            className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-md font-mono text-[10.5px] sm:text-[11px] tracking-[0.12em] uppercase font-semibold hover:brightness-110 transition-all duration-fast ease-tune"
          >
            Open pack · {formattedPrice}
          </Link>
          <button
            type="button"
            data-testid="marketplace-hero-preview"
            onClick={() => onPreview?.(pack.id)}
            className="
              inline-flex items-center gap-2 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-md
              text-warm font-mono text-[10.5px] sm:text-[11px] tracking-[0.12em] uppercase font-semibold
              transition-all duration-fast ease-tune hover:brightness-110
            "
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03))",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.12), inset 0 0 0 1px rgba(255,255,255,0.08)",
            }}
          >
            <span
              aria-hidden
              className="block w-0 h-0 -ml-0.5"
              style={{
                borderLeft: "7px solid currentColor",
                borderTop: "5px solid transparent",
                borderBottom: "5px solid transparent",
              }}
            />
            <span>Preview 30 s</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function shortCreator(creatorId: string): string {
  if (creatorId === "u_curated") return "Multiverse";
  return creatorId.replace(/^u_/, "");
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
