import { Link } from "react-router-dom";
import type { Pack } from "@multiverse-fm/shared";
import { plateFor } from "@/lib/stationArt";

interface Props {
  packs: Pack[];
}

/**
 * Continuously scrolling horizontal shelf. Content is duplicated so the
 * marquee loop is seamless. Hover anywhere pauses the animation.
 * Edges fade via CSS mask gradient.
 */
export function MarqueeShelf({ packs }: Props) {
  if (packs.length === 0) return null;
  const doubled = [...packs, ...packs];

  return (
    <div
      data-testid="marquee-shelf"
      className="relative overflow-hidden"
      style={{
        maskImage:
          "linear-gradient(90deg, transparent 0%, black 6%, black 94%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(90deg, transparent 0%, black 6%, black 94%, transparent 100%)",
      }}
    >
      <div className="flex gap-4 mvfm-animate-marquee w-max">
        {doubled.map((p, i) => (
          <MarqueeTile key={`${p.id}-${i}`} pack={p} />
        ))}
      </div>
    </div>
  );
}

function MarqueeTile({ pack }: { pack: Pack }) {
  const plate = plateFor(pack.id);
  const img = pack.cover_art_url;
  return (
    <Link
      to={`/p/${pack.id}`}
      className="
        group block w-[200px] flex-shrink-0 rounded-lg overflow-hidden
        border border-glass-soft hover:border-molten/40 transition-colors
      "
    >
      <div
        className="aspect-square"
        style={{
          background: img
            ? `center / cover no-repeat url('${img}'), ${plate.background}`
            : plate.background,
        }}
      />
      <div className="p-3 bg-elev-2/40">
        <div className="text-warm text-[12px] font-medium truncate">
          {pack.title}
        </div>
        <div className="font-mono text-silver text-[10px] tracking-[0.16em]">
          ${(pack.price_cents / 100).toFixed(2)}
        </div>
      </div>
    </Link>
  );
}
