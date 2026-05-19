import { Link } from "react-router-dom";
import type { PackCategory } from "@multiverse/shared";
import { cn } from "@/lib/cn";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

/** Gemini-generated thumbnail per category (run
 * `uv run python -m app.scripts.generate_category_thumbnails` once). */
function thumbnailUrl(category: PackCategory): string {
  return `${API_BASE}/static/images/categories/${category}.png`;
}

interface CardSpec {
  /** Slug used for thumbnail filename + test id. */
  key: string;
  /** Route target. */
  to: string;
  /** Thumbnail key if different from `key` (for non-pack categories). */
  thumbnailKey?: PackCategory;
  label: string;
  blurb: string;
  /** CSS gradient fallback shown until/if the thumbnail loads. */
  background: string;
  /** If true, render with "Coming soon" badge and disable nav. */
  comingSoon?: boolean;
}

const CARDS: CardSpec[] = [
  {
    key: "music",
    to: "/browse/music",
    thumbnailKey: "music",
    label: "Music",
    blurb: "Instrumental beds + cinematic cues.",
    background:
      "radial-gradient(ellipse at 70% 40%, rgba(255,138,61,0.22) 0%, transparent 60%), linear-gradient(135deg, #16100c 0%, #0a0a0c 100%)",
  },
  {
    key: "sfx",
    to: "/browse/sfx",
    thumbnailKey: "sfx",
    label: "Sound effects",
    blurb: "One-shots, foley, impacts. Tile to taste.",
    background:
      "radial-gradient(circle at 30% 30%, rgba(255,106,31,0.35) 0%, transparent 60%), linear-gradient(135deg, #1a1217 0%, #0a0a0c 100%)",
  },
  {
    key: "voices",
    to: "/voices",
    thumbnailKey: "voice_packs",
    label: "Voices",
    blurb: "Character voices — preview, buy, run TTS.",
    background:
      "radial-gradient(circle at 50% 70%, rgba(255,106,31,0.22) 0%, transparent 55%), linear-gradient(180deg, #181410 0%, #0a0a0c 100%)",
  },
  {
    key: "ambient",
    to: "/browse/ambient",
    thumbnailKey: "ambient",
    label: "Ambient beds",
    blurb: "Loopable atmospheres + rooms.",
    background:
      "radial-gradient(ellipse at 20% 80%, rgba(62,90,102,0.30) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(255,106,31,0.18) 0%, transparent 50%), #0a0a0c",
  },
  {
    key: "radio_packs",
    to: "/browse/radio_packs",
    thumbnailKey: "radio_packs",
    label: "Radio packs",
    blurb: "Full station broadcasts — DJ + bed + ad.",
    background:
      "radial-gradient(ellipse at 50% 50%, rgba(255,106,31,0.30) 0%, rgba(255,106,31,0.08) 35%, transparent 75%), #0a0a0c",
    comingSoon: true,
  },
  {
    key: "broadcast_packs",
    to: "/browse/broadcast_packs",
    thumbnailKey: "broadcast_packs",
    label: "Broadcast packs",
    blurb: "Hour-long themed broadcast blocks.",
    background:
      "radial-gradient(circle at 60% 30%, rgba(255,138,61,0.20) 0%, transparent 55%), linear-gradient(225deg, #1a1310 0%, #0a0a0c 70%)",
    comingSoon: true,
  },
];

/**
 * Six numbered category cards in a 2×3 grid (tablet+) / single column (mobile).
 * Each card has a category-flavoured gradient backdrop with a huge Bricolage
 * numeral overlay. Click → /browse/<category>.
 */
export function CategoryDeck() {
  return (
    <div
      data-testid="category-ribbon"
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3"
    >
      {CARDS.map((card, i) => (
        <Link
          key={card.key}
          to={card.to}
          data-testid={`category-card-${card.key}`}
          onClick={(e) => {
            if (card.comingSoon) e.preventDefault();
          }}
          aria-disabled={card.comingSoon}
          className={cn(
            "group relative aspect-[5/4] rounded-lg overflow-hidden",
            "border border-glass-soft transition-all duration-tune ease-tune",
            card.comingSoon
              ? "cursor-not-allowed opacity-70"
              : "hover:border-molten/50",
          )}
          style={{ background: card.background }}
        >
          {card.comingSoon && (
            <span className="absolute top-2 right-2 z-[3] px-2 py-1 rounded-pill bg-molten-tint border border-molten/40 font-mono text-molten text-[8.5px] tracking-[0.22em] uppercase">
              Coming soon
            </span>
          )}
          {/* Gemini thumbnail — sits above gradient fallback. */}
          <img
            src={thumbnailUrl(card.thumbnailKey ?? "music")}
            alt=""
            aria-hidden
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-tune"
            onError={(e) => {
              // Hide on 404 — fallback gradient shows through.
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
          {/* Floor gradient for legibility under the label. */}
          <span
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(180deg, transparent 40%, rgba(10,10,12,0.85) 100%)",
            }}
          />
          <span
            aria-hidden
            className="absolute inset-0 mvfm-grain opacity-25 pointer-events-none"
          />
          <span
            aria-hidden
            className="absolute top-2 left-2.5 mvfm-display text-warm/90 leading-none select-none"
            style={{
              fontSize: "clamp(28px, 4vw, 40px)",
              textShadow: "0 2px 8px rgba(0,0,0,0.6)",
            }}
          >
            {(i + 1).toString().padStart(2, "0")}
          </span>
          <div className="absolute bottom-2 left-2.5 right-2.5">
            <div
              className="mvfm-display text-warm text-[13px] sm:text-[14px] leading-tight"
              style={{ textShadow: "0 2px 6px rgba(0,0,0,0.7)" }}
            >
              {card.label}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
