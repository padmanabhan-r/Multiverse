import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Pack } from "@multiverse/shared";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";

export function StudioBundleNew() {
  const nav = useNavigate();
  const [published, setPublished] = useState<Pack[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceDollars, setPriceDollars] = useState("3");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .listMyPacks()
      .then((all) => setPublished(all.filter((p) => p.status === "published")))
      .catch(() => setPublished([]));
  }, []);

  const subtotalCents = useMemo(() => {
    if (!published) return 0;
    return published
      .filter((p) => selected.has(p.id))
      .reduce((sum, p) => sum + p.price_cents, 0);
  }, [published, selected]);

  const priceCents = Math.round(parseFloat(priceDollars || "0") * 100);
  const floorCents = Math.round(subtotalCents * 0.75);
  const savingsCents = Math.max(0, subtotalCents - priceCents);
  const belowFloor = priceCents > 0 && priceCents < floorCents;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    setErr(null);
    if (selected.size < 2) {
      setErr("Pick at least 2 packs.");
      return;
    }
    if (!title.trim()) {
      setErr("Title required.");
      return;
    }
    if (belowFloor) {
      setErr(`Price must be at least ${Math.round(floorCents / 10)} ⚡.`);
      return;
    }
    setBusy(true);
    try {
      const bundle = await api.createBundle({
        title: title.trim(),
        description: description.trim(),
        price_cents: priceCents,
        pack_ids: [...selected],
      });
      await api.publishBundle(bundle.id);
      nav("/creator");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "create failed");
      setBusy(false);
    }
  }

  if (published === null) {
    return <div className="text-silver" data-testid="bundle-loading">Loading…</div>;
  }

  if (published.length < 2) {
    return (
      <section data-testid="bundle-need-more" className="space-y-3">
        <h1 className="font-display text-warm text-2xl">Not enough packs.</h1>
        <p className="text-silver text-[13px]">
          Publish at least 2 packs before bundling.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6 pb-8" data-testid="bundle-builder">
      <header>
        <div className="font-mono text-silver2 text-[10px] tracking-[0.32em] uppercase">
          Studio · New bundle
        </div>
        <h1 className="font-display text-warm text-3xl">Bundle packs.</h1>
      </header>

      <div className="space-y-2">
        <label className="font-mono text-silver2 text-[10px] tracking-[0.28em] uppercase">
          Pick packs (2+)
        </label>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {published.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                data-testid={`bundle-pack-${p.id}`}
                onClick={() => toggle(p.id)}
                className={cn(
                  "w-full text-left p-3 rounded-lg border",
                  selected.has(p.id)
                    ? "border-molten/60 bg-molten-tint/40 text-warm"
                    : "border-glass-soft bg-elev-2/60 text-silver hover:text-warm",
                )}
              >
                <div className="font-mono text-[9px] tracking-[0.22em] uppercase text-silver2 mb-1">
                  {p.category}
                </div>
                <div className="font-display">{p.title}</div>
                <div className="text-[11px]">{p.price_credits ?? Math.round(p.price_cents / 10)} ⚡</div>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="font-mono text-silver2 text-[10px] tracking-[0.28em] uppercase">
            Title
          </label>
          <input
            data-testid="bundle-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Indie game starter"
            className="
              w-full p-2 rounded-md bg-elev-2/60 border border-glass-soft
              text-warm text-[13px] placeholder:text-silver/60
            "
          />
        </div>
        <div className="space-y-1">
          <label className="font-mono text-silver2 text-[10px] tracking-[0.28em] uppercase">
            Bundle price (USD)
          </label>
          <input
            data-testid="bundle-price"
            type="number"
            min="0.50"
            step="0.50"
            value={priceDollars}
            onChange={(e) => setPriceDollars(e.target.value)}
            className="
              w-full p-2 rounded-md bg-elev-2/60 border border-glass-soft
              text-warm text-[13px]
            "
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="font-mono text-silver2 text-[10px] tracking-[0.28em] uppercase">
          Description
        </label>
        <textarea
          data-testid="bundle-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="
            w-full min-h-16 p-2 rounded-md bg-elev-2/60 border border-glass-soft
            text-warm text-[13px]
          "
        />
      </div>

      <div
        data-testid="savings-strip"
        className="p-3 rounded-md bg-elev-2/40 border border-glass-soft text-[12px] text-silver space-y-1"
      >
        <div>Subtotal of selected: <span className="text-warm">{Math.round(subtotalCents / 10)} ⚡</span></div>
        <div>Floor (75%): <span className="text-warm">{Math.round(floorCents / 10)} ⚡</span></div>
        {savingsCents > 0 && !belowFloor && (
          <div>
            Buyers save: <span className="text-molten">{Math.round(savingsCents / 10)} ⚡</span>
          </div>
        )}
        {belowFloor && (
          <div className="text-molten">
            Below floor — increase price to publish.
          </div>
        )}
      </div>

      {err && <div className="text-molten text-[12px]">{err}</div>}

      <button
        type="button"
        data-testid="bundle-submit"
        onClick={submit}
        disabled={busy || selected.size < 2 || belowFloor}
        className="
          px-4 py-2.5 rounded-md bg-molten text-[11px] tracking-[0.22em]
          uppercase font-mono font-semibold disabled:opacity-40
          hover:bg-molten-glow shadow-bloom
        "
        style={{ color: "#1a0700" }}
      >
        {busy ? "Publishing…" : "Publish bundle"}
      </button>
    </section>
  );
}
