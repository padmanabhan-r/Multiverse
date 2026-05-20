import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PackCategory } from "@multiverse/shared";
import { cn } from "@/lib/cn";

/** Cycled background images — pulled from the 6 Gemini category thumbnails.
 * Slow cross-fade every 6 s. Each image is 5:4 1024×819, perfect for a wide
 * hero band. Failure-tolerant: any 404 hides itself, the layer below still
 * supplies an atmospheric gradient.
 */
const R2_PUBLIC =
  import.meta.env.VITE_R2_PUBLIC_BASE_URL ??
  "https://pub-435ae75e0b144d9ca5df30f156449361.r2.dev";

const _HERO_BG_VERSION = "v2";
const HERO_BG_IMAGES: ReadonlyArray<string> = [
  `${R2_PUBLIC}/categories/music.png?v=${_HERO_BG_VERSION}`,
  `${R2_PUBLIC}/categories/ambient.png?v=${_HERO_BG_VERSION}`,
  `${R2_PUBLIC}/categories/radio_packs.png?v=${_HERO_BG_VERSION}`,
  `${R2_PUBLIC}/categories/broadcast_packs.png?v=${_HERO_BG_VERSION}`,
  `${R2_PUBLIC}/categories/sfx.png?v=${_HERO_BG_VERSION}`,
];

type HeroCategory =
  | "all"
  | "voices"
  | Exclude<PackCategory, "voice_packs">;

const CATEGORY_LABEL: Record<HeroCategory, string> = {
  all: "All packs",
  music: "Music",
  sfx: "Sound effects",
  voices: "Voices",
  ambient: "Ambient",
  radio_packs: "Radio packs · soon",
  broadcast_packs: "Broadcast packs · soon",
};

const COMING_SOON: ReadonlyArray<HeroCategory> = [
  "radio_packs",
  "broadcast_packs",
];

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
  onSubmit?: (q: string, category: HeroCategory) => void;
}

export function HomeSearchHero({ onSubmit }: HomeSearchHeroProps) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<HeroCategory>("all");
  const [showMenu, setShowMenu] = useState(false);
  const [bgIdx, setBgIdx] = useState(0);

  // Cycle background images every 6 s with cross-fade. Honours
  // prefers-reduced-motion when the browser supports matchMedia (jsdom
  // doesn't, so we skip the test there safely).
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => {
      setBgIdx((i) => (i + 1) % HERO_BG_IMAGES.length);
    }, 6000);
    return () => window.clearInterval(id);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit(q, category);
      return;
    }
    if (COMING_SOON.includes(category)) return;
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    const qs = params.toString() ? `?${params.toString()}` : "";
    if (category === "voices") {
      navigate(`/voices${qs}`);
      return;
    }
    const path = category === "all" ? `/browse${qs}` : `/browse/${category}${qs}`;
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
        relative w-full rounded-xl
        border border-glass-soft
        px-5 sm:px-10 lg:px-14
        py-[36px] sm:py-[48px] lg:py-[60px]
      "
    >
      {/* Cycling hero background images — slow cross-fade, ken-burns drift. */}
      <div aria-hidden className="absolute inset-0 -z-20 overflow-hidden">
        {HERO_BG_IMAGES.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            loading={i === 0 ? "eager" : "lazy"}
            className={cn(
              "absolute inset-0 w-full h-full object-cover transition-opacity",
              "mvfm-animate-ken-burns",
            )}
            style={{
              opacity: i === bgIdx ? 0.55 : 0,
              transitionDuration: "1800ms",
              transitionTimingFunction: "var(--mvfm-ease)",
            }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ))}
        {/* Darken overlay for legibility */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(10,10,12,0.55) 0%, rgba(10,10,12,0.75) 60%, rgba(10,10,12,0.92) 100%)",
          }}
        />
      </div>

      {/* Atmospheric layered background — molten/teal, no purple/blue */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background: [
            "radial-gradient(ellipse at 20% 30%, rgba(255,106,31,0.18), transparent 55%)",
            "radial-gradient(ellipse at 80% 70%, rgba(255,138,61,0.16), transparent 60%)",
            "radial-gradient(ellipse at 50% 100%, rgba(62,90,102,0.20), transparent 55%)",
          ].join(", "),
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 mvfm-grain opacity-50 pointer-events-none -z-10"
      />
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none -z-10"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 40%, rgba(0,0,0,0.50) 100%)",
        }}
      />
      {/* Top + bottom scan-lines */}
      <div aria-hidden className="absolute top-0 left-0 right-0 mvfm-scanline" />
      <div aria-hidden className="absolute bottom-0 left-0 right-0 mvfm-scanline" />

      <div className="max-w-3xl mx-auto text-center space-y-5 sm:space-y-6">
        {/* Headline */}
        <div className="space-y-2">
          <div
            data-testid="home-hero-eyebrow"
            className="font-mono text-silver2 text-[10px] tracking-[0.32em] uppercase"
          >
            AI-native audio marketplace + creator studio
          </div>
          <h1
            data-testid="home-hero-headline"
            className="mvfm-display text-warm leading-[0.95]"
            style={{ fontSize: "clamp(30px, 4vw, 56px)" }}
          >
            Buy audio. Make your own. Sell it. Voices too. Get paid.
          </h1>
          <p className="text-silver text-[14px] sm:text-[15px] max-w-2xl mx-auto font-body leading-relaxed">
            Royalty-free packs, music and voices for <span className="text-warm font-medium">videos, games and content</span>.
            Or generate your own sounds and voice clones, then <span className="text-warm font-medium">publish, sell, keep 70%</span>.
          </p>
        </div>

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
                  max-h-[260px] overflow-y-auto
                  rounded-md mvfm-glass shadow-panel
                "
              >
                {(Object.keys(CATEGORY_LABEL) as Array<HeroCategory>).map(
                  (key) => {
                    const soon = COMING_SOON.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        data-testid={`home-hero-category-${key}`}
                        disabled={soon}
                        onClick={() => {
                          if (soon) return;
                          setCategory(key);
                          setShowMenu(false);
                        }}
                        className={cn(
                          "block w-full text-left px-3 py-2 font-mono",
                          "text-[10.5px] tracking-[0.16em] uppercase",
                          "transition-colors duration-fast ease-tune",
                          soon
                            ? "text-silver2/50 cursor-not-allowed italic"
                            : category === key
                              ? "bg-molten-tint text-molten"
                              : "text-silver hover:text-warm hover:bg-white/[0.03]",
                        )}
                      >
                        {CATEGORY_LABEL[key]}
                      </button>
                    );
                  },
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

        {/* Trust badges — small mono pills under the search bar */}
        <div
          data-testid="home-hero-trust"
          className="flex flex-wrap items-center justify-center gap-1.5 mt-3"
        >
          {[
            "Sounds",
            "Music",
            "Voices",
            "Ambient",
            "Radio packs · soon",
            "Broadcast packs · soon",
          ].map((t) => (
            <span
              key={t}
              className="
                px-2.5 py-1 rounded-pill
                bg-elev-2/40 border border-glass-soft
                font-mono text-silver2 text-[9.5px] tracking-[0.18em] uppercase
              "
            >
              {t}
            </span>
          ))}
        </div>

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

function shortLabel(c: HeroCategory): string {
  switch (c) {
    case "all":
      return "All";
    case "sfx":
      return "SFX";
    case "music":
      return "Music";
    case "voices":
      return "Voices";
    case "ambient":
      return "Ambient";
    case "radio_packs":
      return "Radio";
    case "broadcast_packs":
      return "Broadcast";
  }
}
