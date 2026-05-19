import { Link } from "react-router-dom";
import type { Pack } from "@multiverse/shared";
import { plateFor } from "@/lib/stationArt";

interface Props {
  creatorId: string;
  displayName: string;
  bio?: string | null;
  packs: Pack[];
}

/**
 * Two-column spotlight: portrait creator card (left) + three stacked
 * horizontal pack rows (right). Collapses to vertical on mobile.
 */
export function CreatorSpotlight({ creatorId, displayName, bio, packs }: Props) {
  const trio = packs.slice(0, 3);
  if (trio.length === 0) return null;

  return (
    <div
      data-testid="creator-spotlight"
      className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 sm:gap-8"
    >
      {/* Left: creator card */}
      <Link
        to={`/u/${creatorId}`}
        className="
          group relative aspect-square lg:aspect-auto rounded-xl overflow-hidden
          border border-glass-soft hover:border-molten/40
          transition-colors duration-tune ease-tune
          flex flex-col justify-between p-5
        "
        style={{
          background:
            "radial-gradient(circle at 30% 30%, rgba(255,106,31,0.18) 0%, transparent 60%), linear-gradient(135deg, #1a1310 0%, #0a0a0c 100%)",
        }}
      >
        <span
          aria-hidden
          className="absolute inset-0 mvfm-grain opacity-40 pointer-events-none"
        />
        <div className="relative">
          <div className="font-mono text-silver2 text-[9px] tracking-[0.32em] uppercase mb-2">
            Creator spotlight
          </div>
          <div className="mvfm-display text-warm text-[28px] sm:text-[32px] leading-[0.95] mb-3">
            {displayName}
          </div>
          {bio && (
            <p className="text-silver text-[12px] font-body leading-snug line-clamp-3">
              {bio}
            </p>
          )}
        </div>
        <div className="relative font-mono text-molten text-[10px] tracking-[0.22em] uppercase">
          View storefront →
        </div>
      </Link>

      {/* Right: three pack rows */}
      <ul className="space-y-3">
        {trio.map((p) => (
          <li key={p.id}>
            <SpotlightPack pack={p} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function SpotlightPack({ pack }: { pack: Pack }) {
  const plate = plateFor(pack.id);
  const img = pack.cover_art_url;
  return (
    <Link
      to={`/p/${pack.id}`}
      data-testid={`spotlight-pack-${pack.id}`}
      className="
        group flex items-center gap-4 p-3 rounded-lg
        bg-elev-2/40 border border-glass-soft hover:border-molten/40
        transition-colors duration-tune ease-tune
      "
    >
      <div
        className="w-16 h-16 sm:w-20 sm:h-20 rounded-md flex-shrink-0"
        style={{
          background: img
            ? `center / cover no-repeat url('${img}'), ${plate.background}`
            : plate.background,
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="font-mono text-silver2 text-[9px] tracking-[0.28em] uppercase mb-1">
          {pack.category.replace("_", " ")}
        </div>
        <div className="mvfm-display text-warm text-[18px] leading-[1] mb-1 truncate">
          {pack.title}
        </div>
        <div className="text-silver text-[11px] font-body line-clamp-1">
          {pack.description || "—"}
        </div>
      </div>
      <div className="font-mono text-molten text-[13px] tracking-[0.12em] flex-shrink-0">
        {pack.price_credits ?? Math.round(pack.price_cents / 10)} ⚡
      </div>
    </Link>
  );
}
