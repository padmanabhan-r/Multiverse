import { Link, useNavigate, useParams } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { plateFor } from "@/lib/stationArt";
import { cn } from "@/lib/cn";
import { useBundle } from "@/lib/queries";
import type { Pack } from "@multiverse/shared";

export function BundleDetail() {
  const { bundleId } = useParams<{ bundleId: string }>();
  const { data, isLoading, isError, error, refetch } = useBundle(bundleId);

  if (isLoading) return <BundleSkeleton />;
  if (isError) return <BundleErrorView message={(error as Error)?.message} onRetry={() => refetch()} />;
  if (!data) return <BundleNotFound id={bundleId} />;

  return <BundleView bundle={data.bundle} packs={data.packs} />;
}

function BundleView({
  bundle,
  packs,
}: {
  bundle: { id: string; creator_id: string; title: string; description: string; cover_art_url: string | null; price_cents: number; tags: string[]; purchases_count: number };
  packs: Pack[];
}) {
  const navigate = useNavigate();
  const { user } = useUser();
  const isOwner = !!user && user.id === bundle.creator_id;
  const plate = plateFor(bundle.id);

  const totalSamples = packs.reduce((n, p) => n + (p.sample_count ?? 0), 0);
  const savings = packs.reduce((n, p) => n + (p.price_cents ?? 0), 0) - bundle.price_cents;
  const savingsPct = packs.length > 0 && savings > 0
    ? Math.round((savings / packs.reduce((n, p) => n + (p.price_cents ?? 0), 0)) * 100)
    : 0;

  return (
    <div data-testid="bundle-page" className="-mx-3 sm:-mx-6 lg:-mx-8 -mt-6">
      {/* Hero */}
      <section
        className="relative w-full overflow-hidden h-[300px] sm:h-[380px] border-b border-glass-soft"
      >
        <div
          className="absolute inset-0"
          style={{
            background: bundle.cover_art_url
              ? `center / cover no-repeat url('${bundle.cover_art_url}'), ${plate.background}`
              : plate.background,
          }}
        />
        {plate.accentLayer && !bundle.cover_art_url && (
          <div aria-hidden className="absolute inset-0" style={{ background: plate.accentLayer }} />
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

        <div className="absolute top-3 left-3 sm:top-4 sm:left-6 z-[3] font-mono text-silver2 text-[9.5px] tracking-[0.22em] uppercase">
          <Link
            to="/browse"
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md hover:text-warm transition-colors duration-fast ease-tune"
          >
            <svg viewBox="0 0 12 12" fill="none" aria-hidden className="size-3">
              <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to marketplace
          </Link>
        </div>

        <div
          className={cn(
            "absolute left-3 sm:left-6 lg:left-10 z-[3]",
            "bottom-5 sm:bottom-8 max-w-[92%] sm:max-w-[640px]",
            "p-4 sm:p-5 rounded-xl",
            "mvfm-glass mvfm-glass-top-edge",
          )}
        >
          <div className="flex items-center gap-2.5 mb-2.5 font-mono text-silver2 text-[10px] tracking-[0.16em] uppercase">
            <span className="text-molten inline-flex items-center gap-1.5">
              <span
                className="size-1.5 rounded-full bg-molten"
                style={{ boxShadow: "0 0 8px var(--mvfm-molten-glow)" }}
                aria-hidden
              />
              Bundle
            </span>
            <span className="size-0.5 rounded-full bg-silver2/60" aria-hidden />
            <span>{packs.length} packs</span>
            <span className="size-0.5 rounded-full bg-silver2/60" aria-hidden />
            <span>{totalSamples} samples</span>
            {savingsPct > 0 && (
              <>
                <span className="size-0.5 rounded-full bg-silver2/60" aria-hidden />
                <span className="text-molten">Save {savingsPct}%</span>
              </>
            )}
          </div>

          <h1
            className="font-mono font-semibold text-warm text-[28px] sm:text-[38px] lg:text-[48px] leading-[0.95] tracking-[-0.01em] mb-2.5"
            style={{ fontFeatureSettings: '"ss01","ss02"' }}
          >
            {bundle.title}
          </h1>

          {bundle.description && (
            <p className="font-body text-warm/85 text-[13px] sm:text-[15px] leading-[1.5] max-w-[500px]">
              {bundle.description}
            </p>
          )}
        </div>
      </section>

      {/* Content */}
      <section className="px-3 sm:px-6 lg:px-10 py-8 sm:py-10 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8">
        {/* Pack list */}
        <div>
          <div className="flex items-baseline justify-between mb-4 sm:mb-6">
            <h2 className="font-mono text-warm text-[12px] tracking-[0.18em] uppercase font-semibold">
              Included packs
            </h2>
            <span className="font-mono text-silver2 text-[9.5px] tracking-[0.18em] uppercase">
              {packs.length} packs
            </span>
          </div>
          <div className="space-y-2">
            {packs.map((pack) => (
              <BundlePackRow key={pack.id} pack={pack} navigate={navigate} />
            ))}
          </div>

          {bundle.tags.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-1.5">
              {bundle.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 rounded-md font-mono text-[9px] tracking-[0.18em] uppercase text-silver2 border border-glass-soft"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Buy sidebar */}
        <aside
          className="self-start sticky top-[calc(var(--mvfm-topbar-h)+24px)] mvfm-glass mvfm-glass-top-edge rounded-xl p-4 sm:p-5 space-y-4"
        >
          <div>
            <div className="font-mono text-silver2 text-[9px] tracking-[0.22em] uppercase">
              {isOwner ? "Your bundle" : "Buy this bundle"}
            </div>
            <div className="font-mono text-warm text-[15px] truncate mt-1">{bundle.title}</div>
          </div>

          <div className="flex items-baseline justify-between border-t border-glass-soft pt-3">
            <span className="font-mono text-silver2 text-[9px] tracking-[0.22em] uppercase">Price</span>
            <span className="font-mono text-warm text-[20px] tracking-[-0.005em] font-semibold">
              ${(bundle.price_cents / 100).toFixed(2)}
            </span>
          </div>

          {savingsPct > 0 && (
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-silver2 text-[9px] tracking-[0.22em] uppercase">vs. individual</span>
              <span className="font-mono text-molten text-[12px] font-semibold">
                Save {savingsPct}%
              </span>
            </div>
          )}

          {!isOwner && (
            <button
              type="button"
              disabled
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-md font-mono text-[10.5px] tracking-[0.18em] uppercase font-semibold opacity-60 cursor-not-allowed"
              style={{
                color: "#1a0700",
                background: "var(--mvfm-molten)",
                boxShadow: "0 0 0 1px rgba(255,106,31,0.7), inset 0 1px 0 rgba(255,255,255,0.28)",
              }}
            >
              Buy bundle
            </button>
          )}

          <p className="text-silver2 text-[10.5px] leading-[1.5]">
            {isOwner
              ? `${bundle.purchases_count} purchase${bundle.purchases_count === 1 ? "" : "s"} so far.`
              : "Royalty-free. Own all packs in this bundle at a discounted price."}
          </p>
        </aside>
      </section>
    </div>
  );
}

function BundlePackRow({ pack, navigate }: { pack: Pack; navigate: ReturnType<typeof useNavigate> }) {
  const CATEGORY_LABEL: Record<string, string> = {
    sfx: "SFX",
    music: "Music",
    voice_packs: "Voice",
    ambient: "Ambient",
    radio_packs: "Radio",
    broadcast_packs: "Broadcast",
  };

  return (
    <div
      className="flex items-center gap-3 px-3 sm:px-4 py-3 rounded-md border border-glass-soft bg-elev-2/30 hover:border-glass transition-colors duration-fast ease-tune cursor-pointer"
      onClick={() => navigate(`/p/${pack.id}`)}
      onKeyDown={(e) => e.key === "Enter" && navigate(`/p/${pack.id}`)}
      role="button"
      tabIndex={0}
      aria-label={`View pack: ${pack.title}`}
    >
      {pack.cover_art_url ? (
        <img
          src={pack.cover_art_url}
          alt=""
          className="size-10 rounded object-cover flex-shrink-0"
        />
      ) : (
        <div className="size-10 rounded flex-shrink-0 bg-elev-2 border border-glass-soft" />
      )}
      <div className="flex-1 min-w-0">
        <div className="font-mono text-warm text-[13px] truncate">{pack.title}</div>
        <div className="font-mono text-silver2 text-[9.5px] tracking-[0.14em] uppercase mt-0.5">
          {CATEGORY_LABEL[pack.category] ?? pack.category} · {pack.sample_count ?? 0} samples
        </div>
      </div>
      <span className="font-mono text-silver2 text-[11px] flex-shrink-0">
        ${(pack.price_cents / 100).toFixed(0)}
      </span>
      <svg viewBox="0 0 12 12" fill="none" aria-hidden className="size-3 text-silver2 flex-shrink-0">
        <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function BundleSkeleton() {
  return (
    <div className="-mx-3 sm:-mx-6 lg:-mx-8 -mt-6">
      <div className="h-[300px] sm:h-[380px] bg-elev-2 animate-pulse" />
      <div className="px-6 py-8 space-y-3">
        <div className="h-3 w-32 bg-elev-2 animate-pulse rounded" />
        <div className="h-6 w-64 bg-elev-2 animate-pulse rounded" />
      </div>
    </div>
  );
}

function BundleErrorView({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div className="min-h-[60vh] grid place-items-center text-center px-6">
      <div className="space-y-3">
        <div className="font-mono text-molten text-[10px] tracking-[0.32em] uppercase">Signal lost</div>
        <p className="text-warm/85 text-[14px]">Couldn't load this bundle.</p>
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

function BundleNotFound({ id }: { id: string | undefined }) {
  return (
    <div className="min-h-[60vh] grid place-items-center text-center p-6">
      <div className="space-y-3">
        <div className="font-mono text-silver2 text-[10px] tracking-[0.28em] uppercase">Signal lost</div>
        <h1 className="font-display text-warm text-2xl tracking-tight">
          No bundle at <span className="text-molten">/bundles/{id ?? "?"}</span>
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
