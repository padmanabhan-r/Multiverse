import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type PublicCreatorPage } from "@/lib/api";

export function CreatorStorefront() {
  const { creatorId } = useParams<{ creatorId: string }>();
  const [data, setData] = useState<PublicCreatorPage | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!creatorId) return;
    api
      .creatorPublic(creatorId)
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : "load failed"));
  }, [creatorId]);

  if (err) {
    return (
      <div data-testid="storefront-error" className="text-molten">
        {err}
      </div>
    );
  }
  if (!data) {
    return (
      <div data-testid="storefront-loading" className="text-silver">
        Loading…
      </div>
    );
  }

  const { creator, packs, bundles } = data;

  return (
    <section className="space-y-6 pb-8" data-testid="storefront-page">
      <header className="flex items-center gap-4">
        {creator.avatar_url && (
          <img
            src={creator.avatar_url}
            alt={creator.display_name}
            className="w-16 h-16 rounded-full object-cover border border-glass-soft"
          />
        )}
        <div className="space-y-0.5">
          <div className="font-mono text-silver2 text-[10px] tracking-[0.32em] uppercase">
            Creator
          </div>
          <h1
            data-testid="storefront-name"
            className="font-display text-warm text-3xl tracking-tight"
          >
            {creator.display_name}
          </h1>
          {creator.bio && (
            <p className="text-silver text-[13px] max-w-prose">{creator.bio}</p>
          )}
          <div className="text-silver text-[11px] font-mono tracking-[0.22em] uppercase">
            {creator.published_pack_count} packs · {creator.bundle_count} bundles
          </div>
        </div>
      </header>

      <section className="space-y-2">
        <h2 className="font-display text-warm text-lg">Packs</h2>
        {packs.length === 0 ? (
          <div className="text-silver text-[12px] italic">No published packs.</div>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {packs.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/p/${p.id}`}
                  data-testid={`storefront-pack-${p.id}`}
                  className="group block rounded-lg overflow-hidden border border-glass-soft hover:border-molten/40 transition-colors"
                >
                  <div
                    className="aspect-square relative"
                    style={{
                      background: p.cover_art_url
                        ? `center/cover no-repeat url('${p.cover_art_url}')`
                        : "var(--mvfm-elev-2)",
                    }}
                  >
                    <div className="absolute top-1.5 left-1.5 font-mono text-[8.5px] tracking-[0.2em] uppercase text-silver2 bg-base/60 px-1 py-0.5 rounded-sm">
                      {p.category}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-base/90">
                      <div className="font-mono text-warm text-[11px] truncate">{p.title}</div>
                      <div className="font-mono text-molten text-[10px]">
                        {p.price_credits ?? Math.round(p.price_cents / 10)} ⚡
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {bundles.length > 0 && (
        <section className="space-y-2" data-testid="storefront-bundles">
          <h2 className="font-display text-warm text-lg">Bundles</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {bundles.map((b) => (
              <li key={b.id}>
                <Link
                  to={`/bundles/${b.id}`}
                  data-testid={`storefront-bundle-${b.id}`}
                  className="block p-3 rounded-lg bg-elev-2/60 border border-glass-soft hover:border-molten/40 transition-colors"
                >
                  <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-silver2 mb-1">
                    Bundle
                  </div>
                  <div className="font-display text-warm">{b.title}</div>
                  <div className="text-silver text-[11px]">
                    {(b as { price_credits?: number }).price_credits ?? Math.round(b.price_cents / 10)} ⚡
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
