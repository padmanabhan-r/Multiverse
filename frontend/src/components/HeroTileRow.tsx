import { Link } from "react-router-dom";
import type { Pack } from "@multiverse-fm/shared";
import { plateFor } from "@/lib/stationArt";

interface Props {
  packs: Pack[];
}

/**
 * Three big 16:9 hero tiles in a row. Each uses pack.hero_art_url first
 * (gpt-image-2 plate) and falls back through cover_art_url → procedural plate.
 */
export function HeroTileRow({ packs }: Props) {
  const trio = packs.slice(0, 3);
  if (trio.length === 0) return null;

  return (
    <div
      data-testid="hero-tile-row"
      className="grid grid-cols-1 md:grid-cols-3 gap-4"
    >
      {trio.map((p) => (
        <HeroTile key={p.id} pack={p} />
      ))}
    </div>
  );
}

function HeroTile({ pack }: { pack: Pack }) {
  const plate = plateFor(pack.id);
  const img = pack.hero_art_url || pack.cover_art_url;
  return (
    <Link
      to={`/p/${pack.id}`}
      data-testid={`hero-tile-${pack.id}`}
      className="
        group relative block aspect-[16/9] rounded-xl overflow-hidden
        border border-glass-soft hover:border-molten/40
        transition-all duration-tune ease-tune
      "
      style={{
        background: img
          ? `center / cover no-repeat url('${img}'), ${plate.background}`
          : plate.background,
      }}
    >
      <span
        aria-hidden
        className="absolute inset-0 mvfm-grain opacity-40 pointer-events-none"
      />
      <span
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, transparent 40%, rgba(10,10,12,0.88) 100%)",
        }}
      />
      <div className="absolute top-3 left-4 font-mono text-silver2 text-[9px] tracking-[0.28em] uppercase">
        {pack.category.replace("_", " ")}
      </div>
      <div className="absolute bottom-4 left-4 right-4">
        <div className="mvfm-display text-warm text-[22px] sm:text-[26px] leading-[0.95] mb-1 transition-transform duration-tune ease-tune group-hover:translate-y-[-2px]">
          {pack.title}
        </div>
        <div className="font-mono text-silver text-[10px] tracking-[0.18em]">
          ${(pack.price_cents / 100).toFixed(2)}
        </div>
      </div>
    </Link>
  );
}
