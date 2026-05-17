import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type LibraryItem } from "@/lib/api";

export function Library() {
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .library()
      .then(setItems)
      .catch((e) => setErr(e instanceof Error ? e.message : "load failed"));
  }, []);

  if (err) {
    return (
      <div data-testid="library-error" className="text-molten">
        {err}
      </div>
    );
  }

  if (items === null) {
    return (
      <div data-testid="library-loading" className="text-silver">
        Loading…
      </div>
    );
  }

  return (
    <section className="space-y-6 pb-8" data-testid="library-page">
      <header className="space-y-1">
        <div className="font-mono text-silver2 text-[10px] tracking-[0.32em] uppercase">
          Your library
        </div>
        <h1 className="font-display text-warm text-3xl sm:text-[40px] tracking-tight">
          {items.length === 0 ? "Nothing here yet." : "Your packs."}
        </h1>
        <p className="text-silver text-[14px]">
          {items.length === 0
            ? "Buy a pack from Discover to see it here."
            : `${items.length} pack${items.length === 1 ? "" : "s"} owned.`}
        </p>
      </header>

      {items.length === 0 ? (
        <Link
          to="/browse"
          data-testid="library-browse-cta"
          className="
            inline-block px-3.5 py-2 rounded-md bg-molten text-[10px]
            tracking-[0.22em] uppercase font-mono font-semibold shadow-bloom
          "
          style={{ color: "#1a0700" }}
        >
          Browse the marketplace
        </Link>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((i) => (
            <li key={i.purchase_id}>
              <Link
                to={`/p/${i.pack_id}`}
                data-testid={`library-pack-${i.pack_id}`}
                className="
                  block p-3 rounded-lg bg-elev-2/60 border border-glass-soft
                  hover:border-molten/40 transition-colors
                "
              >
                {i.cover_art_url && (
                  <img
                    src={i.cover_art_url}
                    alt={i.title}
                    className="w-full aspect-square rounded mb-2 object-cover"
                  />
                )}
                <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-silver2 mb-1">
                  {i.category} · {i.license_kind}
                </div>
                <div className="font-display text-warm">{i.title}</div>
                <div className="text-silver text-[11px]">
                  Paid ${(i.price_paid_cents / 100).toFixed(2)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
