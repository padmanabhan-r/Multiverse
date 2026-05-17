import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PackCategory } from "@multiverse-fm/shared";
import { cn } from "@/lib/cn";

const CATEGORY_LABEL: Record<"all" | PackCategory, string> = {
  all: "All packs",
  sfx: "Sound effects",
  music: "Music",
  voice_packs: "Voice packs",
  ambient: "Ambient",
  radio_packs: "Radio packs",
  broadcast_packs: "Broadcast packs",
};

const TRENDING_TAGS: ReadonlyArray<string> = [
  "noir",
  "cyberpunk",
  "orbital",
  "wartime",
  "rain",
  "city",
  "fantasy",
  "tavern",
  "g-funk",
  "ambient",
];

export interface HomeSearchHeroProps {
  /** Optional explicit submit override (tests). Otherwise navigates. */
  onSubmit?: (q: string, category: "all" | PackCategory) => void;
}

export function HomeSearchHero({ onSubmit }: HomeSearchHeroProps) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<"all" | PackCategory>("all");
  const [showMenu, setShowMenu] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit(q, category);
      return;
    }
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    const path =
      category === "all"
        ? `/browse${params.toString() ? `?${params.toString()}` : ""}`
        : `/browse/${category}${params.toString() ? `?${params.toString()}` : ""}`;
    navigate(path);
  };

  const handleTag = (tag: string) => {
    const params = new URLSearchParams({ q: tag });
    navigate(`/browse?${params.toString()}`);
  };

  return (
    <section
      data-testid="home-hero"
      className="
        relative w-full overflow-hidden rounded-xl
        border border-glass-soft
        px-5 sm:px-10 lg:px-14
        py-8 sm:py-10
      "
    >
      {/* Atmospheric layered background */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background: [
            "radial-gradient(ellipse at 20% 30%, rgba(255,106,31,0.15), transparent 55%)",
            "radial-gradient(ellipse at 80% 70%, rgba(214,82,60,0.18), transparent 60%)",
            "radial-gradient(ellipse at 50% 90%, rgba(62,90,102,0.2), transparent 55%)",
            "linear-gradient(180deg, #15161a 0%, #0a0a0c 100%)",
          ].join(", "),
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 mvfm-grain opacity-50 pointer-events-none -z-10"
      />
      {/* Soft vignette */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none -z-10"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 40%, rgba(0,0,0,0.45) 100%)",
        }}
      />

      <div className="max-w-3xl mx-auto text-center space-y-4 sm:space-y-5">
        {/* Search row */}
        <form
          onSubmit={handleSubmit}
          data-testid="home-hero-search"
          role="search"
          className="
            relative max-w-2xl mx-auto mt-4 sm:mt-6
            flex items-stretch gap-0 rounded-pill overflow-visible
            bg-elev-2/80 border border-glass shadow-panel backdrop-blur-panel
          "
        >
          {/* Category dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu((s) => !s)}
              data-testid="home-hero-category"
              className="
                h-12 sm:h-14 pl-4 sm:pl-5 pr-3 sm:pr-4
                inline-flex items-center gap-2
                font-mono text-[10.5px] sm:text-[11px] tracking-[0.18em] uppercase
                text-warm hover:text-molten transition-colors duration-fast ease-tune
                border-r border-glass-soft
              "
              aria-haspopup="listbox"
              aria-expanded={showMenu}
            >
              <span className="hidden sm:inline">{CATEGORY_LABEL[category]}</span>
              <span className="sm:hidden">{shortLabel(category)}</span>
              <svg viewBox="0 0 10 10" fill="none" aria-hidden className="size-2.5">
                <path
                  d="M2 3.5L5 6.5L8 3.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {showMenu && (
              <div
                role="listbox"
                data-testid="home-hero-category-menu"
                className="
                  absolute left-0 top-full mt-1 z-30 min-w-[180px]
                  rounded-md mvfm-glass overflow-hidden
                "
              >
                {(Object.keys(CATEGORY_LABEL) as Array<"all" | PackCategory>).map(
                  (key) => (
                    <button
                      key={key}
                      type="button"
                      data-testid={`home-hero-category-${key}`}
                      onClick={() => {
                        setCategory(key);
                        setShowMenu(false);
                      }}
                      className={cn(
                        "block w-full text-left px-3 py-2 font-mono",
                        "text-[10.5px] tracking-[0.16em] uppercase",
                        "transition-colors duration-fast ease-tune",
                        category === key
                          ? "bg-molten-tint text-molten"
                          : "text-silver hover:text-warm hover:bg-white/[0.03]",
                      )}
                    >
                      {CATEGORY_LABEL[key]}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>

          {/* Search input */}
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search packs, tags, creators…"
            aria-label="Search packs"
            data-testid="home-hero-input"
            className="
              flex-1 min-w-0 h-12 sm:h-14 px-3 sm:px-5
              bg-transparent
              font-body text-warm text-[14px] sm:text-[15px]
              placeholder:text-silver2
              focus:outline-none
            "
          />

          {/* Search submit */}
          <button
            type="submit"
            data-testid="home-hero-submit"
            aria-label="Search"
            style={{ color: "#1a0700" }}
            className="
              m-1 px-4 sm:px-6
              rounded-pill bg-molten hover:bg-molten-glow shadow-bloom
              font-mono text-[10.5px] sm:text-[11px] tracking-[0.18em] uppercase font-semibold
              inline-flex items-center gap-2
              transition-colors duration-fast ease-tune
            "
          >
            <svg viewBox="0 0 12 12" fill="none" aria-hidden className="size-3.5">
              <circle cx="5" cy="5" r="3" stroke="currentColor" strokeWidth="1.4" />
              <path d="M7.5 7.5L10 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <span className="hidden sm:inline">Search</span>
          </button>
        </form>

        {/* Trending tags */}
        <div
          data-testid="home-hero-trending"
          className="flex flex-wrap items-center justify-center gap-1.5 mt-4 sm:mt-5"
        >
          <span className="font-mono text-silver2 text-[9.5px] tracking-[0.22em] uppercase mr-1">
            Trending
          </span>
          {TRENDING_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => handleTag(tag)}
              data-testid={`home-hero-tag-${tag}`}
              className="
                px-2.5 py-1 rounded-pill
                bg-elev-2/60 border border-glass-soft text-silver
                hover:text-warm hover:border-glass
                font-mono text-[10.5px] tracking-[0.04em]
                transition-colors duration-fast ease-tune
              "
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function shortLabel(c: "all" | PackCategory): string {
  switch (c) {
    case "all":
      return "All";
    case "sfx":
      return "SFX";
    case "music":
      return "Music";
    case "voice_packs":
      return "Voice";
    case "ambient":
      return "Ambient";
    case "radio_packs":
      return "Radio";
    case "broadcast_packs":
      return "Broadcast";
  }
}
