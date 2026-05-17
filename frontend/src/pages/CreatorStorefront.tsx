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
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {packs.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/p/${p.id}`}
                  data-testid={`storefront-pack-${p.id}`}
                  className="
                    block p-3 rounded-lg bg-elev-2/60 border border-glass-soft
                    hover:border-molten/40 transition-colors
                  "
                >
                  {p.cover_art_url && (
                    <img
                      src={p.cover_art_url}
                      alt={p.title}
                      className="w-full aspect-square rounded mb-2 object-cover"
                    />
                  )}
                  <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-silver2 mb-1">
                    {p.category}
                  </div>
                  <div className="font-display text-warm">{p.title}</div>
                  <div className="text-silver text-[11px]">
                    ${(p.price_cents / 100).toFixed(2)}
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
              <li
                key={b.id}
                className="p-3 rounded-lg bg-elev-2/60 border border-glass-soft"
              >
                <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-silver2 mb-1">
                  bundle
                </div>
                <div className="font-display text-warm">{b.title}</div>
                <div className="text-silver text-[11px]">
                  ${(b.price_cents / 100).toFixed(2)}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
