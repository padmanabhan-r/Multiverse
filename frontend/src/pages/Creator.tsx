import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Bundle, Pack } from "@multiverse/shared";
import { api, type CreatorMe, type CreatorSale } from "@/lib/api";

type SaleRow = CreatorSale;
type Tab = "drafts" | "published" | "bundles" | "sales";

export function Creator() {
  const [me, setMe] = useState<CreatorMe | null>(null);
  const [packs, setPacks] = useState<Pack[] | null>(null);
  const [bundles, setBundles] = useState<Bundle[] | null>(null);
  const [sales, setSales] = useState<SaleRow[] | null>(null);
  const [tab, setTab] = useState<Tab>("drafts");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.creatorMe(),
      api.listMyPacks(),
      api.listMyBundles(),
      api.creatorSales().catch(() => [] as SaleRow[]),
    ])
      .then(([m, p, b, s]) => {
        setMe(m);
        setPacks(p);
        setBundles(b);
        setSales(s);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "load failed"));
  }, []);

  if (err) return <div className="text-molten">{err}</div>;
  if (!me || !packs || !bundles || !sales) {
    return <div data-testid="creator-loading" className="text-silver">Loading…</div>;
  }

  const drafts = packs.filter((p) => p.status === "draft");
  const published = packs.filter((p) => p.status === "published");

  return (
    <section className="space-y-6 pb-8" data-testid="creator-page">
      <header className="space-y-1">
        <div className="font-mono text-silver2 text-[10px] tracking-[0.32em] uppercase">
          Creator dashboard
        </div>
        <h1 className="font-display text-warm text-3xl sm:text-[40px] tracking-tight">
          Your universe.
        </h1>
        <p className="text-silver text-[14px]">
          {me.display_name ? `Signed in as ${me.display_name}.` : "Welcome."}
        </p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="metric-strip">
        <Metric label="Drafts" value={String(me.draft_count)} />
        <Metric label="Published" value={String(me.published_count)} />
        <Metric label="Bundles" value={String(me.bundle_count)} />
        <Metric
          label="Sales (30d)"
          value={`${Math.round(me.sales_cents_30d / 10)} ⚡`}
          sub={`${me.sales_count_30d} packs sold`}
        />
      </div>

      <div className="flex gap-2 flex-wrap">
        <Link
          to="/studio/new"
          data-testid="cta-new-pack"
          className="
            px-3.5 py-2 rounded-md bg-molten text-[10px] tracking-[0.22em]
            uppercase font-mono font-semibold shadow-bloom
          "
          style={{ color: "#1a0700" }}
        >
          + New pack
        </Link>
        <Link
          to="/studio/bundle/new"
          data-testid="cta-new-bundle"
          className="
            px-3.5 py-2 rounded-md bg-elev-2/60 border border-glass-soft
            text-silver hover:text-warm font-mono text-[10px]
            tracking-[0.22em] uppercase
          "
        >
          + New bundle
        </Link>
      </div>

      <div className="flex gap-1" data-testid="tabs">
        {(["drafts", "published", "bundles", "sales"] as const).map((t) => (
          <button
            key={t}
            type="button"
            data-testid={`tab-${t}`}
            onClick={() => setTab(t)}
            className={
              tab === t
                ? "px-3 py-1.5 rounded-md bg-molten-tint text-molten font-mono text-[10px] tracking-[0.22em] uppercase"
                : "px-3 py-1.5 rounded-md text-silver border border-glass-soft hover:text-warm font-mono text-[10px] tracking-[0.22em] uppercase"
            }
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "drafts" && <PackGrid packs={drafts} linkBase="/studio/draft" empty="No drafts. Build a pack to start." />}
      {tab === "published" && <PackGrid packs={published} linkBase="/p" empty="Nothing published yet." />}
      {tab === "bundles" && <BundleGrid bundles={bundles} />}
      {tab === "sales" && <SalesTable rows={sales} />}
    </section>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="p-3 rounded-lg bg-elev-2/60 border border-glass-soft">
      <div className="font-mono text-[9px] tracking-[0.28em] uppercase text-silver2">
        {label}
      </div>
      <div className="font-display text-warm text-2xl">{value}</div>
      {sub && <div className="text-silver text-[10px]">{sub}</div>}
    </div>
  );
}

function PackGrid({
  packs,
  linkBase,
  empty,
}: {
  packs: Pack[];
  linkBase: string;
  empty: string;
}) {
  if (packs.length === 0) {
    return <div className="text-silver text-[12px] italic">{empty}</div>;
  }
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {packs.map((p) => (
        <li key={p.id}>
          <Link
            to={`${linkBase}/${p.id}`}
            data-testid={`pack-${p.id}`}
            className="block p-3 rounded-lg bg-elev-2/60 border border-glass-soft hover:border-molten/40"
          >
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-silver2 mb-1">
              {p.category} · {p.sample_count} samples
            </div>
            <div className="font-display text-warm">{p.title}</div>
            <div className="text-silver text-[11px]">
              {p.price_credits ?? Math.round(p.price_cents / 10)} ⚡
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function BundleGrid({ bundles }: { bundles: Bundle[] }) {
  if (bundles.length === 0) {
    return (
      <div className="text-silver text-[12px] italic">
        No bundles yet. Publish 2+ packs then build a bundle.
      </div>
    );
  }
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {bundles.map((b) => (
        <li key={b.id}>
          <div
            data-testid={`bundle-${b.id}`}
            className="p-3 rounded-lg bg-elev-2/60 border border-glass-soft"
          >
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-silver2 mb-1">
              {b.status} · bundle
            </div>
            <div className="font-display text-warm">{b.title}</div>
            <div className="text-silver text-[11px]">
              {(b as { price_credits?: number }).price_credits ?? Math.round(b.price_cents / 10)} ⚡
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function SalesTable({ rows }: { rows: SaleRow[] }) {
  if (rows.length === 0) {
    return <div className="text-silver text-[12px] italic">No sales yet.</div>;
  }
  return (
    <table className="w-full text-[12px]" data-testid="sales-table">
      <thead className="text-silver2 font-mono text-[10px] tracking-[0.22em] uppercase">
        <tr>
          <th className="text-left py-2">Pack</th>
          <th className="text-left">License</th>
          <th className="text-right">Paid</th>
          <th className="text-right">When</th>
        </tr>
      </thead>
      <tbody className="text-warm">
        {rows.map((r) => (
          <tr
            key={r.purchase_id}
            className="border-t border-glass-soft"
            data-testid={`sale-${r.purchase_id}`}
          >
            <td className="py-2">{r.pack_title}</td>
            <td>{r.license_kind}</td>
            <td className="text-right">{Math.round(r.price_paid_cents / 10)} ⚡</td>
            <td className="text-right text-silver">
              {r.created_at ? new Date(r.created_at).toLocaleDateString() : ""}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
