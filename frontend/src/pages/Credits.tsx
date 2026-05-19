import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type CreditsResponse, type LedgerEntry } from "@/lib/api";
import { cn } from "@/lib/cn";

interface TopupPack {
  credits: number;
  price_cents: number;
}

const REASON_LABEL: Record<string, string> = {
  trial_grant: "Free trial",
  monthly_grant: "Monthly subscription",
  topup: "Credit top-up",
  gen_sfx: "SFX generation",
  gen_ambient: "Ambient generation",
  gen_music_60s: "Music generation",
  gen_music_120s: "Music generation",
  gen_voice_design: "Voice design",
  gen_tts: "TTS generation",
  gen_tts_5min: "TTS generation",
  buy_pack: "Pack purchase",
  buy_voice: "Voice purchase",
  buy_bundle: "Bundle purchase",
  royalty: "Creator royalty",
  refund: "Refund",
  admin_adjust: "Adjustment",
};

export function Credits() {
  const [me, setMe] = useState<CreditsResponse | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[] | null>(null);
  const [packs, setPacks] = useState<TopupPack[] | null>(null);
  const [busyPack, setBusyPack] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.myCredits(), api.ledger(50), api.listTopupPacks()])
      .then(([m, l, p]) => {
        setMe(m);
        setLedger(l);
        setPacks(p.packs);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "load failed"));
  }, []);

  async function topup(credits: number) {
    setBusyPack(credits);
    setErr(null);
    try {
      const { url } = await api.topupCredits(credits);
      window.location.href = url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "top-up failed");
      setBusyPack(null);
    }
  }

  if (err) return <div className="text-molten">{err}</div>;
  if (!me || !ledger)
    return (
      <div data-testid="credits-loading" className="text-silver">
        Loading…
      </div>
    );

  return (
    <section className="space-y-8 pb-8" data-testid="credits-page">
      <header>
        <div className="font-mono text-silver2 text-[10px] tracking-[0.32em] uppercase">
          Your credits
        </div>
        <h1 className="mvfm-display text-warm text-[44px] sm:text-[64px] leading-[0.95] mt-2">
          {me.balance} <span className="text-molten">⚡</span>
        </h1>
        <p className="text-silver text-[14px] mt-1">
          Monthly grant: {me.tier_monthly_grant} credits
        </p>
      </header>

      <section className="space-y-3" data-testid="topup-section">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="font-mono text-warm text-[12px] tracking-[0.22em] uppercase font-semibold">
            Top up credits
          </h2>
          <span className="font-mono text-silver2 text-[10px] tracking-[0.22em] uppercase">
            Stripe · test mode
          </span>
        </div>
        {packs === null ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-24 rounded-lg bg-elev-2 animate-pulse shadow-[inset_0_0_0_1px_var(--mvfm-border-soft)]"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {packs.map((p, i) => (
              <TopupTile
                key={p.credits}
                pack={p}
                busy={busyPack === p.credits}
                disabled={busyPack !== null && busyPack !== p.credits}
                badge={
                  i === 1 ? "Popular" : i === packs.length - 1 ? "Best value" : null
                }
                onClick={() => topup(p.credits)}
              />
            ))}
          </div>
        )}
        {err && <div className="text-molten text-[12px]">{err}</div>}
        <Link
          to="/browse"
          className="
            inline-flex items-center px-3 py-1.5 rounded-md
            bg-elev-2/60 border border-glass-soft text-silver hover:text-warm
            font-mono text-[10px] tracking-[0.22em] uppercase
          "
        >
          Browse the catalog →
        </Link>
      </section>

      <section className="space-y-3">
        <h2 className="font-mono text-warm text-[11px] tracking-[0.28em] uppercase">
          Recent activity
        </h2>
        <div className="mvfm-scanline" aria-hidden />

        {ledger.length === 0 ? (
          <div className="text-silver italic text-[13px] pt-4">
            No credit activity yet.
          </div>
        ) : (
          <table className="w-full text-[12.5px]" data-testid="ledger-table">
            <thead className="text-silver2 font-mono text-[10px] tracking-[0.22em] uppercase">
              <tr>
                <th className="text-left py-2">When</th>
                <th className="text-left">Reason</th>
                <th className="text-right">Δ</th>
                <th className="text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((row) => {
                const positive = row.delta > 0;
                return (
                  <tr
                    key={row.id}
                    data-testid={`ledger-row-${row.id}`}
                    className="border-t border-glass-soft"
                  >
                    <td className="py-2 text-silver">
                      {row.created_at
                        ? new Date(row.created_at).toLocaleString()
                        : "—"}
                    </td>
                    <td className="text-warm">
                      {REASON_LABEL[row.reason] ?? row.reason}
                      {row.note && (
                        <span className="text-silver2 ml-2 text-[11px]">
                          · {row.note}
                        </span>
                      )}
                    </td>
                    <td
                      className={cn(
                        "text-right font-mono tabular-nums",
                        positive ? "text-molten" : "text-silver",
                      )}
                    >
                      {positive ? "+" : ""}
                      {row.delta}
                    </td>
                    <td className="text-right font-mono tabular-nums text-silver">
                      {row.balance_after}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </section>
  );
}

function TopupTile({
  pack,
  busy,
  disabled,
  badge,
  onClick,
}: {
  pack: TopupPack;
  busy: boolean;
  disabled: boolean;
  badge: string | null;
  onClick: () => void;
}) {
  const dollars = (pack.price_cents / 100).toFixed(0);
  const perCredit = (pack.price_cents / pack.credits / 100).toFixed(3);
  return (
    <button
      type="button"
      data-testid={`topup-tile-${pack.credits}`}
      onClick={onClick}
      disabled={busy || disabled}
      className={cn(
        "relative text-left p-4 rounded-lg",
        "border border-glass-soft bg-elev-2/60",
        "hover:border-molten/60 hover:bg-molten-tint/40",
        "transition-colors duration-fast ease-tune",
        (busy || disabled) && "opacity-60 cursor-not-allowed",
      )}
    >
      {badge && (
        <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-pill bg-molten-tint border border-molten/40 font-mono text-molten text-[8.5px] tracking-[0.22em] uppercase">
          {badge}
        </span>
      )}
      <div className="mvfm-display text-warm text-[22px] leading-none">
        {pack.credits} <span className="text-molten text-[18px]">⚡</span>
      </div>
      <div className="font-mono text-warm text-[14px] tracking-tight mt-2">
        ${dollars}
      </div>
      <div className="font-mono text-silver2 text-[9.5px] tracking-[0.18em] uppercase mt-1">
        ${perCredit} / credit
      </div>
      {busy && (
        <div className="mt-2 font-mono text-molten text-[10px] tracking-[0.22em] uppercase">
          Opening Stripe…
        </div>
      )}
    </button>
  );
}
