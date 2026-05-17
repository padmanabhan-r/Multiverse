import { useCallback, useRef } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface CoverShelfProps<T> {
  title: string;
  /** Subtitle / count chip displayed next to title, e.g. "CURATED · 06" */
  countLabel?: string;
  /** Right-side text link, e.g. "See all" */
  linkLabel?: string;
  onLinkClick?: () => void;
  items: ReadonlyArray<T>;
  renderItem: (item: T, index: number) => ReactNode;
  /** Approximate per-item scroll step in px; defaults to 218 (tile-lg + gap). */
  scrollStep?: number;
  className?: string;
}

export function CoverShelf<T>({
  title,
  countLabel,
  linkLabel,
  onLinkClick,
  items,
  renderItem,
  scrollStep = 218,
  className,
}: CoverShelfProps<T>) {
  const railRef = useRef<HTMLDivElement>(null);

  const scrollBy = useCallback(
    (delta: number) => {
      railRef.current?.scrollBy({ left: delta, behavior: "smooth" });
    },
    [],
  );

  return (
    <section data-testid={`shelf-${slug(title)}`} className={cn("min-w-0", className)}>
      <header className="flex items-baseline justify-between mb-3 px-1">
        <h2 className="flex items-baseline gap-3">
          <span className="font-mono text-warm text-[12px] tracking-[0.18em] uppercase font-semibold">
            {title}
          </span>
          {countLabel && (
            <span className="font-mono text-silver2 text-[9.5px] tracking-[0.18em] uppercase">
              {countLabel}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {linkLabel && (
            <button
              type="button"
              onClick={onLinkClick}
              className="
                font-mono text-silver text-[10px] tracking-[0.18em] uppercase
                hover:text-warm transition-colors duration-fast ease-tune
              "
            >
              {linkLabel}
            </button>
          )}
          {/* Arrow nav — desktop only */}
          <div className="hidden sm:inline-flex items-center gap-1 ml-3">
            <ShelfArrow direction="prev" onClick={() => scrollBy(-scrollStep)} />
            <ShelfArrow direction="next" onClick={() => scrollBy(scrollStep)} />
          </div>
        </div>
      </header>

      <div
        ref={railRef}
        data-testid={`rail-${slug(title)}`}
        className="
          flex gap-[18px] pb-1
          overflow-x-auto scroll-smooth snap-x snap-mandatory
          [scrollbar-width:none]
          [&::-webkit-scrollbar]:hidden
        "
      >
        {items.map((item, i) => (
          <RailItem key={i}>{renderItem(item, i)}</RailItem>
        ))}
      </div>
    </section>
  );
}

function RailItem({ children }: { children: ReactNode }) {
  // Wrapper enforces scroll-snap-align even if child forgets.
  return <div className="snap-start">{children}</div>;
}

function ShelfArrow({
  direction,
  onClick,
}: {
  direction: "prev" | "next";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "prev" ? "Scroll left" : "Scroll right"}
      className="
        size-7 rounded-md grid place-items-center
        bg-elev-2/60 border border-glass-soft
        text-silver hover:text-warm hover:border-glass
        transition-colors duration-fast ease-tune
      "
    >
      <svg
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden
        className="size-3"
        style={{ transform: direction === "prev" ? "rotate(180deg)" : undefined }}
      >
        <path
          d="M4 2l4 4-4 4"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
