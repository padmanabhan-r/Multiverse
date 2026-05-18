import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type CreditsResponse, type LedgerEntry } from "@/lib/api";
import { cn } from "@/lib/cn";

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
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.myCredits(), api.ledger(50)])
      .then(([m, l]) => {
        setMe(m);
        setLedger(l);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "load failed"));
  }, []);

  if (err) return <div className="text-molten">{err}</div>;
  if (!me || !ledger)
    return (
      <div data-testid="credits-loading" className="text-silver">
        Loading…
      </div>
    );

  const dollars = (me.balance / 10).toFixed(2);

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
          ≈ ${dollars} at 10 credits = $1 · monthly grant{" "}
          {me.tier_monthly_grant} credits
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <Link
          to="/pricing"
          data-testid="topup-cta"
          className="
            inline-flex items-center px-4 py-2.5 rounded-md bg-molten
            font-mono text-[11px] tracking-[0.22em] uppercase font-semibold
            hover:bg-molten-glow shadow-bloom
          "
          style={{ color: "#1a0700" }}
        >
          Top up credits
        </Link>
        <Link
          to="/browse"
          className="
            inline-flex items-center px-4 py-2.5 rounded-md
            bg-elev-2/60 border border-glass-soft text-silver hover:text-warm
            font-mono text-[11px] tracking-[0.22em] uppercase
          "
        >
          Browse the catalog
        </Link>
      </div>

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
