import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Pack } from "@multiverse/shared";
import { CategoryDeck } from "@/components/CategoryDeck";
import { CoverShelf } from "@/components/CoverShelf";
import { EditorialEyebrow } from "@/components/EditorialEyebrow";
import { FooterCTA } from "@/components/FooterCTA";
import { HomeSearchHero } from "@/components/HomeSearchHero";
import { MarketplaceHero } from "@/components/MarketplaceHero";
import { PackTile } from "@/components/PackTile";
import { api, type MarketplaceVoice } from "@/lib/api";
import { plateFor } from "@/lib/stationArt";
import { usePacks } from "@/lib/queries";

export function Home() {
  const navigate = useNavigate();

  const featured = usePacks({ sort: "popular", limit: 30 });
  const trending = usePacks({ sort: "popular", limit: 30 });
  const fresh = usePacks({ sort: "new", limit: 30 });
  const music = usePacks({ category: "music", sort: "new", limit: 8 });
  const sfx = usePacks({ category: "sfx", sort: "new", limit: 8 });
  const ambient = usePacks({ category: "ambient", sort: "new", limit: 8 });

  const [voices, setVoices] = useState<MarketplaceVoice[] | null>(null);
  useEffect(() => {
    api.listMarketplaceVoices().then(setVoices).catch(() => setVoices([]));
  }, []);

  // Radio_packs + broadcast_packs are coming soon — filter from cross-cut shelves.
  const isComingSoon = (cat: Pack["category"]) =>
    cat === "radio_packs" || cat === "broadcast_packs";

  const heroPack =
    featured.data?.find((p) => p.title === "Noir Rhodes nights") ??
    featured.data?.find((p) => !isComingSoon(p.category)) ??
    featured.data?.find((p) => !isComingSoon(p.category)) ??
    null;

  const trendingFiltered = (trending.data ?? []).filter(
    (p) => !isComingSoon(p.category),
  );
  const freshFiltered = (fresh.data ?? []).filter(
    (p) => !isComingSoon(p.category),
  );

  const onTileSelect = (id: string) => navigate(`/p/${id}`);

  return (
    <div data-testid="home-page" className="space-y-6 sm:space-y-8 pb-8">
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
        title="Sound effects"
        countLabel={sfx.data ? `${pad(sfx.data.length)} packs` : undefined}
        link={{ label: "Explore SFX", onClick: () => navigate("/browse/sfx") }}
        loading={sfx.isLoading}
        error={sfx.isError}
        items={sfx.data ?? []}
        onSelect={onTileSelect}
      />
      <Shelf
        title="Ambient"
        countLabel={ambient.data ? `${pad(ambient.data.length)} packs` : undefined}
        link={{
          label: "Explore ambient",
          onClick: () => navigate("/browse/ambient"),
        }}
        loading={ambient.isLoading}
        error={ambient.isError}
        items={ambient.data ?? []}
        onSelect={onTileSelect}
      />
      <VoiceShelf voices={voices} />

      {/* Coming soon teasers */}
      <ComingSoonShelf
        title="Radio packs"
        blurb="Full in-world FM broadcasts — DJ + bed + ads."
      />
      <ComingSoonShelf
        title="Broadcast packs"
        blurb="Hour-long themed broadcast blocks."
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

function VoiceShelf({ voices }: { voices: MarketplaceVoice[] | null }) {
  const navigate = useNavigate();
  if (voices === null) return <ShelfSkeleton title="Voices" />;
  if (voices.length === 0) return null;
  return (
    <CoverShelf
      title="Voices"
      countLabel={`${pad(voices.length)} voices`}
      linkLabel="Explore voices"
      onLinkClick={() => navigate("/voices")}
      items={voices}
      renderItem={(v: MarketplaceVoice) => <VoiceShelfTile voice={v} />}
    />
  );
}

function VoiceShelfTile({ voice }: { voice: MarketplaceVoice }) {
  const plate = plateFor(voice.id);
  return (
    <Link
      to={`/v/${voice.id}`}
      data-testid={`voice-shelf-tile-${voice.id}`}
      className="
        group block w-[180px] flex-shrink-0 rounded-md overflow-hidden
        border border-glass-soft hover:border-molten/40
        transition-colors duration-tune ease-tune
      "
    >
      <div
        className="aspect-square relative"
        style={{
          background: voice.cover_art_url
            ? `center / cover no-repeat url('${voice.cover_art_url}'), ${plate.background}`
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
              "linear-gradient(180deg, transparent 50%, rgba(10,10,12,0.85) 100%)",
          }}
        />
        <div className="absolute top-2 left-2 font-mono text-silver2 text-[9px] tracking-[0.28em] uppercase">
          Voice
        </div>
        <div className="absolute bottom-2 left-2 right-2">
          <div className="mvfm-display text-warm text-[14px] leading-[0.95] truncate">
            {voice.title}
          </div>
          <div className="font-mono text-molten text-[10px] tracking-[0.1em] mt-1">
            {voice.price_credits} ⚡
          </div>
        </div>
      </div>
    </Link>
  );
}

function ComingSoonShelf({
  title,
  blurb,
}: {
  title: string;
  blurb: string;
}) {
  return (
    <section data-testid={`shelf-coming-soon-${slug(title)}`}>
      <div className="flex items-end justify-between mb-3 px-1">
        <div className="font-mono text-warm/60 text-[12px] tracking-[0.18em] uppercase font-semibold">
          {title}
        </div>
        <div className="font-mono text-molten text-[9.5px] tracking-[0.28em] uppercase">
          Coming soon
        </div>
      </div>
      <div
        className="
          rounded-md border border-dashed border-glass-soft
          bg-elev-2/30 px-4 py-6 text-center
        "
      >
        <p className="text-silver text-[12px] max-w-md mx-auto">{blurb}</p>
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
