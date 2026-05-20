import { Link } from "react-router-dom";
import type { Pack } from "@multiverse/shared";
import { cn } from "@/lib/cn";
import { plateFor } from "@/lib/stationArt";

interface Props {
  packs: Pack[];
}

/**
 * Asymmetric editorial layout:
 * - Rank 1: huge 2-col 2-row 16:9 feature with title overlay
 * - Ranks 2–3: two stacked medium tiles next to it
 * - Ranks 4+: smaller 3-col row beneath
 * Mobile collapses to vertical stack.
 */
export function EditorialShelf({ packs }: Props) {
  if (packs.length === 0) return null;
  const [feature, ...rest] = packs;
  const middle = rest.slice(0, 2);
  const tail = rest.slice(2, 8);

  return (
    <div data-testid="editorial-shelf" className="space-y-4">
      {/* Top row: feature 2-col + 2 stacked */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FeaturePack pack={feature} />
        <div className="grid grid-rows-2 gap-4">
          {middle.map((p) => (
            <MediumPack key={p.id} pack={p} />
          ))}
        </div>
      </div>

      {/* Bottom row: 3 small tiles */}
      {tail.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {tail.map((p) => (
            <SmallPack key={p.id} pack={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function FeaturePack({ pack }: { pack: Pack }) {
  const plate = plateFor(pack.id);
  const img = pack.cover_art_url || pack.hero_art_url;
  return (
    <Link
      to={`/p/${pack.id}`}
      data-testid={`feature-${pack.id}`}
      className={cn(
        "group relative block aspect-[16/10] rounded-xl overflow-hidden",
        "border border-glass-soft hover:border-molten/40",
        "transition-all duration-tune ease-tune",
      )}
      style={{
        background: img
          ? `center / cover no-repeat url('${img}'), ${plate.background}`
          : plate.background,
      }}
    >
      <span
        aria-hidden
        className="absolute inset-0 mvfm-grain opacity-50 pointer-events-none"
      />
      <span
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, transparent 30%, rgba(10,10,12,0.85) 100%)",
        }}
      />
      <div className="absolute top-4 left-4 font-mono text-silver2 text-[9px] tracking-[0.28em] uppercase">
        Editor's pick · No. 01
      </div>
      <div className="absolute bottom-4 left-4 right-4">
        <div className="mvfm-display text-warm text-[28px] sm:text-[40px] leading-[0.95] mb-1.5">
          {pack.title}
        </div>
        <div className="font-mono text-silver2 text-[10px] tracking-[0.22em] uppercase">
          {pack.category.replace("_", " ")} ·{" "}
          {pack.price_credits ?? Math.round(pack.price_cents / 10)} ⚡
        </div>
      </div>
    </Link>
  );
}

function MediumPack({ pack }: { pack: Pack }) {
  const plate = plateFor(pack.id);
  const img = pack.cover_art_url || pack.hero_art_url;
  return (
    <Link
      to={`/p/${pack.id}`}
      data-testid={`medium-${pack.id}`}
      className={cn(
        "group relative block rounded-xl overflow-hidden",
        "border border-glass-soft hover:border-molten/40",
        "transition-all duration-tune ease-tune",
      )}
      style={{
        background: img
          ? `center / cover no-repeat url('${img}'), ${plate.background}`
          : plate.background,
      }}
    >
      <span
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, rgba(10,10,12,0.85) 0%, rgba(10,10,12,0.45) 40%, transparent 100%)",
        }}
      />
      <div className="relative p-4 sm:p-5 flex flex-col justify-between min-h-[120px] sm:min-h-[160px]">
        <div className="font-mono text-silver2 text-[9px] tracking-[0.28em] uppercase">
          {pack.category.replace("_", " ")}
        </div>
        <div>
          <div className="mvfm-display text-warm text-[18px] sm:text-[22px] leading-[0.95] mb-1">
            {pack.title}
          </div>
          <div className="font-mono text-silver text-[10px] tracking-[0.18em]">
            {pack.price_credits ?? Math.round(pack.price_cents / 10)} ⚡
          </div>
        </div>
      </div>
    </Link>
  );
}

function SmallPack({ pack }: { pack: Pack }) {
  const plate = plateFor(pack.id);
  const img = pack.cover_art_url;
  return (
    <Link
      to={`/p/${pack.id}`}
      data-testid={`small-${pack.id}`}
      className={cn(
        "group block rounded-lg overflow-hidden",
        "border border-glass-soft hover:border-molten/40",
        "transition-all duration-tune ease-tune",
      )}
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
        <div className="font-mono text-silver2 text-[8.5px] tracking-[0.22em] uppercase mb-0.5 truncate">
          {pack.category.replace("_", " ")}
        </div>
        <div className="text-warm text-[13px] font-medium truncate">
          {pack.title}
        </div>
        <div className="font-mono text-silver text-[10px] tracking-[0.16em]">
          {pack.price_credits ?? Math.round(pack.price_cents / 10)} ⚡
        </div>
      </div>
    </Link>
  );
}
