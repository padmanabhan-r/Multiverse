import type { PackCategory, PackListFilters, PackSort } from "@multiverse-fm/shared";
import { PACK_CATEGORIES } from "@multiverse-fm/shared";
import { cn } from "@/lib/cn";

export interface FilterSidebarProps {
  filters: PackListFilters;
  onChange: (next: PackListFilters) => void;
}

const CATEGORY_LABEL: Record<PackCategory, string> = {
  sfx: "Sound effects",
  music: "Music",
  voice_packs: "Voice packs",
  ambient: "Ambient",
  radio_packs: "Radio packs",
  broadcast_packs: "Broadcast packs",
};

const SORT_OPTIONS: Array<{ value: PackSort; label: string }> = [
  { value: "new", label: "Newest" },
  { value: "popular", label: "Popular" },
  { value: "price_asc", label: "Price ↑" },
  { value: "price_desc", label: "Price ↓" },
];

const PRICE_BUCKETS: Array<{
  label: string;
  min?: number;
  max?: number;
}> = [
  { label: "Any" },
  { label: "Under $10", max: 999 },
  { label: "$10 – $20", min: 1000, max: 2000 },
  { label: "$20 – $30", min: 2000, max: 3000 },
  { label: "Over $30", min: 3001 },
];

export function FilterSidebar({ filters, onChange }: FilterSidebarProps) {
  const setCategory = (cat: PackCategory | undefined) =>
    onChange({ ...filters, category: cat });
  const setSort = (sort: PackSort) => onChange({ ...filters, sort });
  const setPrice = (min?: number, max?: number) =>
    onChange({ ...filters, price_min_cents: min, price_max_cents: max });
  const setQ = (q: string) => onChange({ ...filters, q: q || undefined });

  const activePriceLabel = priceLabelFor(
    filters.price_min_cents,
    filters.price_max_cents,
  );

  return (
    <aside
      data-testid="filter-sidebar"
      className="space-y-6"
    >
      <Section label="Search">
        <input
          type="search"
          value={filters.q ?? ""}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search packs…"
          aria-label="Search packs"
          data-testid="filter-q"
          className="
            w-full px-3 py-2 rounded-md
            bg-elev-2/60 border border-glass-soft
            font-body text-warm text-[13px]
            placeholder:text-silver2/70
            focus:outline-none focus:border-molten/40
            focus:shadow-[0_0_18px_-8px_var(--mvfm-molten-dim)]
            transition-all duration-fast ease-tune
          "
        />
      </Section>

      <Section label="Category">
        <div className="flex flex-col gap-1">
          <FilterRow
            label="All categories"
            active={!filters.category}
            onClick={() => setCategory(undefined)}
            testId="filter-cat-all"
          />
          {PACK_CATEGORIES.map((cat) => (
            <FilterRow
              key={cat}
              label={CATEGORY_LABEL[cat]}
              active={filters.category === cat}
              onClick={() => setCategory(cat)}
              testId={`filter-cat-${cat}`}
            />
          ))}
        </div>
      </Section>

      <Section label="Price">
        <div className="flex flex-col gap-1">
          {PRICE_BUCKETS.map((b) => (
            <FilterRow
              key={b.label}
              label={b.label}
              active={b.label === activePriceLabel}
              onClick={() => setPrice(b.min, b.max)}
              testId={`filter-price-${slug(b.label)}`}
            />
          ))}
        </div>
      </Section>

      <Section label="Sort">
        <div
          role="radiogroup"
          aria-label="Sort"
          data-testid="filter-sort"
          className="flex flex-wrap gap-1"
        >
          {SORT_OPTIONS.map((s) => {
            const active = (filters.sort ?? "new") === s.value;
            return (
              <button
                key={s.value}
                type="button"
                role="radio"
                aria-checked={active}
                data-testid={`filter-sort-${s.value}`}
                onClick={() => setSort(s.value)}
                className={cn(
                  "px-3 py-1.5 rounded-md",
                  "font-mono text-[10px] tracking-[0.14em] uppercase",
                  "border transition-all duration-fast ease-tune",
                  active
                    ? "border-molten/50 bg-molten-tint text-molten"
                    : "border-glass-soft bg-elev-2/40 text-silver hover:text-warm hover:border-glass",
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </Section>
    </aside>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="font-mono text-silver2 text-[9.5px] tracking-[0.22em] uppercase mb-2">
        {label}
      </div>
      {children}
    </div>
  );
}

function FilterRow({
  label,
  active,
  onClick,
  testId,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      data-active={active}
      onClick={onClick}
      className={cn(
        "group flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left",
        "text-[12.5px] font-medium",
        "border-l-2 border-transparent",
        "transition-all duration-fast ease-tune",
        active
          ? "border-l-molten bg-molten-tint text-warm"
          : "text-silver hover:bg-white/[0.03] hover:text-warm",
      )}
    >
      {label}
    </button>
  );
}

function priceLabelFor(min?: number, max?: number): string {
  if (min == null && max == null) return "Any";
  if (min == null && max === 999) return "Under $10";
  if (min === 1000 && max === 2000) return "$10 – $20";
  if (min === 2000 && max === 3000) return "$20 – $30";
  if (min === 3001 && max == null) return "Over $30";
  return "Any";
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
