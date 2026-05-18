import { Link, useNavigate, useParams } from "react-router-dom";
import { cn } from "@/lib/cn";
import { plateFor } from "@/lib/stationArt";
import { BuyPackButton } from "@/components/BuyPackButton";
import { usePack } from "@/lib/queries";

export function Pack() {
  const { packId } = useParams<{ packId: string }>();
  const { data: pack, isLoading, isError, error, refetch } = usePack(packId);

  if (isLoading) return <PackSkeleton />;
  if (isError) return <PackErrorView message={(error as Error)?.message} onRetry={() => refetch()} />;
  if (!pack) return <PackNotFound id={packId} />;

  return <PackView pack={pack} />;
}

function PackView({ pack }: { pack: NonNullable<ReturnType<typeof usePack>["data"]> }) {
  const navigate = useNavigate();
  const plate = plateFor(pack.id);

  const fields: Array<[string, string]> = [
    ["Category", CATEGORY_LABEL[pack.category]],
    [pack.category === "sfx" ? "Sounds" : "Samples", String(pack.sample_count)],
    ["Duration", formatDuration(pack.duration_ms)],
    ["Tags", (pack.tags || []).join(" · ") || "—"],
    ["Moods", (pack.moods || []).join(" · ") || "—"],
    ["Creator", pack.creator_name],
  ];

  return (
    <div data-testid="pack-page" className="-mx-3 sm:-mx-6 lg:-mx-8 -mt-6">
      {/* Hero plate band */}
      <section
        data-testid="pack-hero"
        className="
          relative w-full overflow-hidden
          h-[340px] sm:h-[440px] lg:h-[480px]
          border-b border-glass-soft
        "
      >
        <div
          className="absolute inset-0"
          style={{
            background: pack.cover_art_url
              ? `center / cover no-repeat url('${pack.cover_art_url}'), ${plate.background}`
              : plate.background,
          }}
        />
        {plate.accentLayer && !pack.cover_art_url && (
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: plate.accentLayer }}
          />
        )}
        <div aria-hidden className="absolute inset-0 mvfm-grain opacity-60 pointer-events-none" />
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background: [
              "radial-gradient(ellipse at 30% 65%, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.55) 90%, rgba(0,0,0,0.85) 100%)",
              "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 50%, rgba(10,10,12,0.92) 100%)",
            ].join(", "),
          }}
        />

        <div
          className="absolute top-3 left-3 sm:top-4 sm:left-6 z-[3] flex items-center gap-2 font-mono text-silver2 text-[9.5px] tracking-[0.22em] uppercase"
        >
          <Link
            to="/browse"
            data-testid="pack-back"
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md hover:text-warm transition-colors duration-fast ease-tune"
          >
            <svg viewBox="0 0 12 12" fill="none" aria-hidden className="size-3">
              <path
                d="M8 2L4 6l4 4"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Back to marketplace
          </Link>
        </div>

        <div
          className={cn(
            "absolute left-3 sm:left-6 lg:left-10 z-[3]",
            "bottom-6 sm:bottom-10 max-w-[92%] sm:max-w-[680px]",
            "p-4 sm:p-6 rounded-xl",
            "mvfm-glass mvfm-glass-top-edge",
          )}
        >
          <div className="flex items-center gap-2.5 mb-3 font-mono text-silver2 text-[10px] tracking-[0.16em] uppercase">
            <span className="text-molten inline-flex items-center gap-1.5">
              <span
                className="size-1.5 rounded-full bg-molten"
                style={{ boxShadow: "0 0 8px var(--mvfm-molten-glow)" }}
                aria-hidden
              />
              {CATEGORY_LABEL[pack.category]}
            </span>
            <span className="size-0.5 rounded-full bg-silver2/60" aria-hidden />
            <span>{pack.sample_count} {pack.category === "sfx" ? "sounds" : "samples"}</span>
            <span className="size-0.5 rounded-full bg-silver2/60" aria-hidden />
            <span>{formatDuration(pack.duration_ms)}</span>
          </div>

          <h1
            data-testid="pack-title"
            className="font-mono font-semibold text-warm text-[32px] sm:text-[44px] lg:text-[56px] leading-[0.95] tracking-[-0.01em] mb-3"
            style={{ fontFeatureSettings: '"ss01","ss02"' }}
          >
            {pack.title}
          </h1>

          {pack.description && (
            <p className="font-body text-warm/85 text-[13px] sm:text-[15px] leading-[1.5] max-w-[520px] mb-5">
              {pack.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="pack-play"
              onClick={() => undefined /* Sm wires preview audio */}
              style={{
                color: "#1a0700",
                background: "var(--mvfm-molten)",
                boxShadow:
                  "0 0 0 1px rgba(255,106,31,0.7), 0 10px 30px -10px rgba(255,106,31,0.8), inset 0 1px 0 rgba(255,255,255,0.28)",
              }}
              className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-md font-mono text-[10.5px] tracking-[0.12em] uppercase font-semibold hover:brightness-110 transition-all duration-fast ease-tune"
            >
              <span
                aria-hidden
                className="block w-0 h-0 -ml-0.5"
                style={{
                  borderLeft: "7px solid #1a0700",
                  borderTop: "5px solid transparent",
                  borderBottom: "5px solid transparent",
                }}
              />
              Play 30 s preview
            </button>
            <button
              type="button"
              data-testid="pack-view-creator"
              onClick={() => navigate(`/u/${pack.creator_id}`)}
              className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-md text-warm font-mono text-[10.5px] tracking-[0.12em] uppercase font-semibold transition-all duration-fast ease-tune hover:brightness-110"
              style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03))",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.12), inset 0 0 0 1px rgba(255,255,255,0.08)",
              }}
            >
              View creator
            </button>
          </div>
        </div>
      </section>

      {/* Below-hero content: license + schema */}
      <section className="px-3 sm:px-6 lg:px-10 py-8 sm:py-10 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8">
        <div data-testid="pack-schema">
          <div className="flex items-baseline justify-between mb-4 sm:mb-6">
            <h2 className="font-mono text-warm text-[12px] tracking-[0.18em] uppercase font-semibold">
              Pack details
            </h2>
            <span className="font-mono text-silver2 text-[9.5px] tracking-[0.18em] uppercase">
              {fields.length} fields
            </span>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            {fields.map(([k, v], i) => (
              <div
                key={k}
                data-testid={`pack-field-${i}`}
                className="border-b border-glass-soft pb-3 sm:pb-4"
              >
                <div className="flex items-baseline justify-between gap-3 mb-1.5">
                  <dt className="font-mono text-silver2 text-[9px] tracking-[0.22em] uppercase">
                    {k}
                  </dt>
                  <span className="font-mono text-silver2/60 text-[8.5px] tracking-[0.22em]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <dd className="text-warm text-[13px] leading-[1.5]">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* License + Cart sidebar */}
        <aside
          data-testid="pack-buy"
          className="
            self-start sticky top-[calc(var(--mvfm-topbar-h)+24px)]
            mvfm-glass mvfm-glass-top-edge rounded-xl p-4 sm:p-5
            space-y-4
          "
        >
          <div>
            <div className="font-mono text-silver2 text-[9px] tracking-[0.22em] uppercase">
              Buy this pack
            </div>
            <div className="font-mono text-warm text-[15px] truncate mt-1">
              {pack.title}
            </div>
          </div>

          <div className="flex items-baseline justify-between border-t border-glass-soft pt-3">
            <span className="font-mono text-silver2 text-[9px] tracking-[0.22em] uppercase">
              Price
            </span>
            <span
              data-testid="pack-buy-total"
              className="font-mono text-warm text-[20px] tracking-[-0.005em] font-semibold"
            >
              {pack.price_credits ?? Math.round(pack.price_cents / 10)} ⚡
            </span>
          </div>

          <BuyPackButton pack={pack} className="w-full flex flex-col gap-2" />

          <p className="text-silver2 text-[10.5px] leading-[1.5]">
            Royalty-free. Buyers spend credits to own a pack — no recurring
            fees. Creators earn 70% of every purchase.
          </p>
        </aside>
      </section>
    </div>
  );
}

const CATEGORY_LABEL = {
  sfx: "Sound effects",
  music: "Music",
  voice_packs: "Voice packs",
  ambient: "Ambient",
  radio_packs: "Radio packs",
  broadcast_packs: "Broadcast packs",
} as const;

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function PackSkeleton() {
  return (
    <div data-testid="pack-skeleton" className="-mx-3 sm:-mx-6 lg:-mx-8 -mt-6">
      <div className="h-[340px] sm:h-[440px] bg-elev-2 animate-pulse" />
      <div className="px-6 py-8 space-y-3">
        <div className="h-3 w-32 bg-elev-2 animate-pulse rounded" />
        <div className="h-6 w-72 bg-elev-2 animate-pulse rounded" />
      </div>
    </div>
  );
}

function PackErrorView({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div data-testid="pack-error" className="min-h-[60vh] grid place-items-center text-center px-6">
      <div className="space-y-3">
        <div className="font-mono text-molten text-[10px] tracking-[0.32em] uppercase">
          Signal lost
        </div>
        <p className="text-warm/85 text-[14px]">Couldn't load this pack.</p>
        {message && <p className="font-mono text-silver2 text-[11px]">{message}</p>}
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-elev-2/60 border border-glass-soft text-silver hover:text-warm hover:border-glass font-mono text-[10px] tracking-[0.22em] uppercase transition-colors duration-fast ease-tune"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

function PackNotFound({ id }: { id: string | undefined }) {
  return (
    <div data-testid="pack-not-found" className="min-h-[60vh] grid place-items-center text-center p-6">
      <div className="space-y-3">
        <div className="font-mono text-silver2 text-[10px] tracking-[0.28em] uppercase">
          Signal lost
        </div>
        <h1 className="font-display text-warm text-2xl tracking-tight">
          No pack at <span className="text-molten">/p/{id ?? "?"}</span>
        </h1>
        <Link
          to="/browse"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-elev-2/60 border border-glass-soft text-silver hover:text-warm font-mono text-[10.5px] tracking-[0.18em] uppercase transition-colors duration-fast ease-tune"
        >
          ← Back to marketplace
        </Link>
      </div>
    </div>
  );
}
