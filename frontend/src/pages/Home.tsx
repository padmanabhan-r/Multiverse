import { useNavigate } from "react-router-dom";
import type { Pack } from "@multiverse-fm/shared";
import { CategoryDeck } from "@/components/CategoryDeck";
import { CoverShelf } from "@/components/CoverShelf";
import { EditorialEyebrow } from "@/components/EditorialEyebrow";
import { FooterCTA } from "@/components/FooterCTA";
import { HomeSearchHero } from "@/components/HomeSearchHero";
import { MarketplaceHero } from "@/components/MarketplaceHero";
import { PackTile } from "@/components/PackTile";
import { usePacks } from "@/lib/queries";

export function Home() {
  const navigate = useNavigate();

  const featured = usePacks({ sort: "popular", limit: 30 });
  const trending = usePacks({ sort: "popular", limit: 30 });
  const fresh = usePacks({ sort: "new", limit: 30 });
  const music = usePacks({ category: "music", sort: "new", limit: 8 });
  const radio = usePacks({ category: "radio_packs", sort: "new", limit: 8 });

  // Pin "Noir Rhodes nights" as the curated featured pick. Fall back to the
  // most-popular non-radio pack if that title was renamed/removed.
  const heroPack =
    featured.data?.find((p) => p.title === "Noir Rhodes nights") ??
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
    <div data-testid="home-page" className="space-y-8 sm:space-y-12 pb-8">
      {/* 1. Pixabay-style search hero — enhanced visuals */}
      <HomeSearchHero />

      {/* 2. Compact category deck */}
      <section>
        <EditorialEyebrow eyebrow="Browse by category" right="01 → 06" />
        <CategoryDeck />
      </section>

      {/* 3. Featured pack — smaller cinematic hero */}
      <section>
        <EditorialEyebrow eyebrow="Featured pack" right="this week" />
        <MarketplaceHero
          pack={heroPack}
          loading={featured.isLoading}
          onPreview={onTileSelect}
        />
      </section>

      {/* 4. Standard shelves */}
      <Shelf
        title="Trending"
        countLabel={`${pad(trendingFiltered.length)} packs`}
        link={{ label: "See all", onClick: () => navigate("/browse?sort=popular") }}
        loading={trending.isLoading}
        error={trending.isError}
        items={trendingFiltered}
        onSelect={onTileSelect}
      />
      <Shelf
        title="New this week"
        countLabel={`${pad(freshFiltered.length)} packs`}
        link={{ label: "See all", onClick: () => navigate("/browse") }}
        loading={fresh.isLoading}
        error={fresh.isError}
        items={freshFiltered}
        onSelect={onTileSelect}
      />
      <Shelf
        title="Music"
        countLabel={music.data ? `${pad(music.data.length)} packs` : undefined}
        link={{ label: "Explore music", onClick: () => navigate("/browse/music") }}
        loading={music.isLoading}
        error={music.isError}
        items={music.data ?? []}
        onSelect={onTileSelect}
      />
      <Shelf
        title="Radio packs"
        countLabel={radio.data ? `${pad(radio.data.length)} packs` : undefined}
        link={{
          label: "Explore radio",
          onClick: () => navigate("/browse/radio_packs"),
        }}
        loading={radio.isLoading}
        error={radio.isError}
        items={radio.data ?? []}
        onSelect={onTileSelect}
      />

      {/* 5. Footer CTA — closing */}
      <FooterCTA />
    </div>
  );
}

function Shelf({
  title,
  countLabel,
  link,
  loading,
  error,
  items,
  onSelect,
}: {
  title: string;
  countLabel?: string;
  link: { label: string; onClick: () => void };
  loading: boolean;
  error: boolean;
  items: Pack[];
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
        <PackTile pack={p} size="md" onSelect={onSelect} onPlay={onSelect} />
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
              w-[180px] flex-shrink-0
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
