import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type {
  Pack,
  PackCategory,
  PackListFilters,
} from "@multiverse-fm/shared";
import { PACK_CATEGORIES } from "@multiverse-fm/shared";
import { FilterSidebar } from "@/components/FilterSidebar";
import { PackTile } from "@/components/PackTile";
import { usePacks } from "@/lib/queries";


export function Browse() {
  const { category } = useParams<{ category?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // URL params take precedence on first mount: `?q=` from HomeSearchHero +
  // `?sort=` from Featured "See all" link. Category from path segment.
  const initialCategory = isCategory(category) ? category : undefined;
  const initialQ = searchParams.get("q") ?? undefined;
  const initialSort =
    (searchParams.get("sort") as PackListFilters["sort"]) ?? "new";
  const [filters, setFilters] = useState<PackListFilters>({
    category: initialCategory,
    q: initialQ,
    sort: initialSort,
    limit: 60,
  });

  // Keep URL in sync when category filter changes.
  const handleFiltersChange = (next: PackListFilters) => {
    setFilters(next);
    if (next.category && next.category !== category) {
      navigate(`/browse/${next.category}`, { replace: true });
    } else if (!next.category && category) {
      navigate("/browse", { replace: true });
    }
  };

  const { data, isLoading, isError, error, refetch } = usePacks(filters);
  const packs: Pack[] = data ?? [];

  const onTileSelect = (id: string) => navigate(`/p/${id}`);
  const highlightId = undefined;

  const heading = useMemo(() => {
    if (!filters.category) return "All packs";
    return CATEGORY_HEADING[filters.category];
  }, [filters.category]);

  return (
    <div data-testid="browse-page" className="space-y-6">
      <header className="space-y-1">
        <div className="font-mono text-silver2 text-[10px] tracking-[0.32em] uppercase">
          Discover
        </div>
        <h1
          data-testid="browse-heading"
          className="font-display text-warm text-3xl sm:text-[40px] tracking-tight"
        >
          {heading}
        </h1>
        <p className="text-silver text-[14px] max-w-prose">
          Production-ready audio packs from creators in the Multiverse.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-6 lg:gap-8">
        <FilterSidebar filters={filters} onChange={handleFiltersChange} />

        <section className="min-w-0">
          {isLoading && <BrowseSkeleton />}
          {isError && (
            <BrowseError message={(error as Error)?.message} onRetry={() => refetch()} />
          )}
          {!isLoading && !isError && packs.length === 0 && (
            <EmptyState
              category={filters.category}
              onClear={() => handleFiltersChange({ sort: "new", limit: 60 })}
            />
          )}
          {!isLoading && !isError && packs.length > 0 && (
            <PackGrid
              packs={packs}
              highlightId={highlightId ?? undefined}
              onSelect={onTileSelect}
              onPlay={onTileSelect}
            />
          )}
        </section>
      </div>
    </div>
  );
}

const CATEGORY_HEADING: Record<PackCategory, string> = {
  sfx: "Sound effects",
  music: "Music",
  voice_packs: "Voice packs",
  ambient: "Ambient",
  radio_packs: "Radio packs",
  broadcast_packs: "Broadcast packs",
};

function isCategory(s: string | undefined): s is PackCategory {
  return !!s && (PACK_CATEGORIES as readonly string[]).includes(s);
}

function PackGrid({
  packs,
  highlightId,
  onSelect,
  onPlay,
}: {
  packs: Pack[];
  highlightId?: string;
  onSelect: (id: string) => void;
  onPlay: (id: string) => void;
}) {
  return (
    <div
      data-testid="pack-grid"
      className="
        grid gap-3 sm:gap-4
        grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5
      "
    >
      {packs.map((p) => (
        <PackTile
          key={p.id}
          pack={p}
          size="lg"
          active={p.id === highlightId}
          onSelect={onSelect}
          onPlay={onPlay}
        />
      ))}
    </div>
  );
}

function BrowseSkeleton() {
  return (
    <div
      data-testid="browse-skeleton"
      className="
        grid gap-3 sm:gap-4
        grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5
      "
    >
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="
            aspect-square rounded-md bg-elev-2
            shadow-[inset_0_0_0_1px_var(--mvfm-border-soft)]
            animate-pulse
          "
        />
      ))}
    </div>
  );
}

function BrowseError({
  message,
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <div
      data-testid="browse-error"
      className="
        p-6 rounded-md border border-glass-soft bg-elev-2/40
        text-center space-y-3
      "
    >
      <div className="font-mono text-molten text-[10px] tracking-[0.32em] uppercase">
        Signal lost
      </div>
      <p className="text-warm/85 text-[14px]">
        Couldn't reach the marketplace API.
      </p>
      {message && (
        <p className="text-silver2 text-[11px] font-mono truncate">{message}</p>
      )}
      <button
        type="button"
        onClick={onRetry}
        className="
          inline-flex items-center gap-1.5 px-3 py-2 rounded-md
          bg-elev-2/60 border border-glass-soft text-silver hover:text-warm hover:border-glass
          font-mono text-[10px] tracking-[0.22em] uppercase
          transition-colors duration-fast ease-tune
        "
      >
        Retry
      </button>
    </div>
  );
}

function EmptyState({
  category,
  onClear,
}: {
  category: PackCategory | undefined;
  onClear: () => void;
}) {
  return (
    <div
      data-testid="browse-empty"
      className="
        p-8 rounded-md border border-glass-soft bg-elev-2/40
        text-center space-y-2
      "
    >
      <div className="font-mono text-silver2 text-[10px] tracking-[0.32em] uppercase">
        No packs
      </div>
      <p className="text-warm/85 text-[14px]">
        {category
          ? `No published packs in ${CATEGORY_HEADING[category]} match these filters.`
          : "No packs match these filters."}
      </p>
      <button
        type="button"
        onClick={onClear}
        className="
          mt-2 inline-flex items-center gap-1.5 px-3 py-2 rounded-md
          bg-elev-2/60 border border-glass-soft text-silver hover:text-warm hover:border-glass
          font-mono text-[10px] tracking-[0.22em] uppercase
          transition-colors duration-fast ease-tune
        "
      >
        Clear filters
      </button>
    </div>
  );
}
