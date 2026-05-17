import { useNavigate } from "react-router-dom";
import type { Pack } from "@multiverse-fm/shared";
import { CategoryRibbon } from "@/components/CategoryRibbon";
import { CoverShelf } from "@/components/CoverShelf";
import { HomeSearchHero } from "@/components/HomeSearchHero";
import { MarketplaceHero } from "@/components/MarketplaceHero";
import { PackTile } from "@/components/PackTile";
import { ValuePropSplit } from "@/components/ValuePropSplit";
import { usePacks } from "@/lib/queries";

export function Home() {
  const navigate = useNavigate();

  // Fetch a window so we can filter radio_packs out of generic shelves
  // client-side. Radio packs are heavy multi-stem assets — they get their own
  // dedicated shelf at the very end + a category page.
  const featured = usePacks({ sort: "popular", limit: 30 });
  const trending = usePacks({ sort: "popular", limit: 30 });
  const fresh = usePacks({ sort: "new", limit: 30 });
  const music = usePacks({ category: "music", sort: "new", limit: 8 });
  const radio = usePacks({ category: "radio_packs", sort: "new", limit: 8 });

  // Featured pack should NEVER be a radio pack — those read like radio
  // stations ("Brooklyn 88.7 Night Cab"), not generic marketplace assets.
  const heroPack =
    featured.data?.find((p) => p.category !== "radio_packs") ??
    featured.data?.[0] ??
    null;

  const trendingFiltered = (trending.data ?? []).filter(
    (p) => p.category !== "radio_packs",
  );
  const freshFiltered = (fresh.data ?? []).filter(
    (p) => p.category !== "radio_packs",
  );

  const onTileSelect = (id: string) => navigate(`/p/${id}`);

  return (
    <div data-testid="home-page" className="space-y-6 sm:space-y-8">
      <HomeSearchHero />

      <ValuePropSplit />

      <section className="space-y-3">
        <h2 className="font-mono text-warm text-[12px] tracking-[0.18em] uppercase font-semibold">
          Browse by category
        </h2>
        <CategoryRibbon />
      </section>

      <section className="space-y-3">
        <h2 className="font-mono text-warm text-[12px] tracking-[0.18em] uppercase font-semibold">
          Featured pack
        </h2>
        <MarketplaceHero
          pack={heroPack}
          loading={featured.isLoading}
          onPreview={onTileSelect}
        />
      </section>

      <ShelfBlock
        title="Trending"
        countLabel={`${pad(trendingFiltered.length)} packs`}
        link={{ label: "See all", onClick: () => navigate("/browse?sort=popular") }}
        loading={trending.isLoading}
        error={trending.isError}
        items={trendingFiltered}
        highlightId={undefined}
        onSelect={onTileSelect}
      />

      <ShelfBlock
        title="New this week"
        countLabel={`${pad(freshFiltered.length)} packs`}
        link={{ label: "See all", onClick: () => navigate("/browse") }}
        loading={fresh.isLoading}
        error={fresh.isError}
        items={freshFiltered}
        highlightId={undefined}
        onSelect={onTileSelect}
      />

      <ShelfBlock
        title="Music"
        countLabel={music.data ? `${pad(music.data.length)} packs` : undefined}
        link={{ label: "Explore music", onClick: () => navigate("/browse/music") }}
        loading={music.isLoading}
        error={music.isError}
        items={music.data ?? []}
        highlightId={undefined}
        onSelect={onTileSelect}
      />

      <ShelfBlock
        title="Radio packs"
        countLabel={radio.data ? `${pad(radio.data.length)} packs` : undefined}
        link={{
          label: "Explore radio",
          onClick: () => navigate("/browse/radio_packs"),
        }}
        loading={radio.isLoading}
        error={radio.isError}
        items={radio.data ?? []}
        highlightId={undefined}
        onSelect={onTileSelect}
      />
    </div>
  );
}

function ShelfBlock({
  title,
  countLabel,
  link,
  loading,
  error,
  items,
  highlightId,
  onSelect,
}: {
  title: string;
  countLabel?: string;
  link: { label: string; onClick: () => void };
  loading: boolean;
  error: boolean;
  items: Pack[];
  highlightId?: string;
  onSelect: (id: string) => void;
}) {
  if (loading) return <ShelfSkeleton title={title} />;
  if (error || items.length === 0) return null;
  return (
    <CoverShelf
      title={title}
      countLabel={countLabel}
      linkLabel={link.label}
      onLinkClick={link.onClick}
      items={items}
      renderItem={(p: Pack) => (
        <PackTile
          pack={p}
          size="lg"
          active={p.id === highlightId}
          onSelect={onSelect}
          onPlay={onSelect}
        />
      )}
    />
  );
}

function ShelfSkeleton({ title }: { title: string }) {
  return (
    <section data-testid={`shelf-skeleton-${slug(title)}`}>
      <div className="font-mono text-warm text-[12px] tracking-[0.18em] uppercase font-semibold mb-3 px-1">
        {title}
      </div>
      <div className="flex gap-[18px] overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="
              w-[220px] flex-shrink-0
              aspect-square rounded-md bg-elev-2
              shadow-[inset_0_0_0_1px_var(--mvfm-border-soft)]
              animate-pulse
            "
          />
        ))}
      </div>
    </section>
  );
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}
function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
