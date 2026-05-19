import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api, type CreditsResponse } from "@/lib/api";

export function BillingSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const qc = useQueryClient();
  const [credits, setCredits] = useState<CreditsResponse | null>(null);

  // Poll credits a couple of times in case the Stripe webhook hasn't landed
  // yet (typical lag is sub-second in test mode but we don't want to flash
  // the old balance).
  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    async function refresh() {
      try {
        const m = await api.myCredits();
        if (cancelled) return;
        setCredits(m);
        qc.invalidateQueries({ queryKey: ["me", "credits"] });
      } catch {
        // ignore
      }
    }
    const tick = () => {
      attempt += 1;
      refresh();
      if (attempt < 4) window.setTimeout(tick, 1500);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [qc]);

  return (
    <section
      className="space-y-6 pb-8 max-w-2xl"
      data-testid="billing-success-page"
    >
      <header className="space-y-2">
        <div className="font-mono text-molten text-[10px] tracking-[0.32em] uppercase">
          Payment received · Stripe
        </div>
        <h1 className="mvfm-display text-warm text-[40px] sm:text-[56px] leading-[0.95]">
          You're topped up.
        </h1>
        <p className="text-silver text-[14px] max-w-prose">
          Stripe confirmed the charge. Your credits are ready to spend on
          packs, voices, and Studio generation.
        </p>
      </header>

      <div
        className="rounded-xl border border-molten/40 bg-molten-tint/40 px-5 py-5"
        data-testid="success-balance-card"
      >
        <div className="font-mono text-silver2 text-[10px] tracking-[0.28em] uppercase mb-1">
          Current balance
        </div>
        <div className="mvfm-display text-warm text-[44px] sm:text-[56px] leading-[0.95]">
          {credits ? (
            <>
              {credits.balance}{" "}
              <span className="text-molten text-[36px]">⚡</span>
            </>
          ) : (
            <span className="text-silver text-[14px]">Refreshing…</span>
          )}
        </div>
        {sessionId && (
          <div className="mt-2 font-mono text-silver2 text-[10px] tracking-[0.18em] truncate">
            Session: {sessionId}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          to="/voices"
          data-testid="success-voices-cta"
          style={{ color: "#1a0700" }}
          className="
            inline-flex items-center px-4 py-2.5 rounded-md
            bg-molten hover:bg-molten-glow shadow-bloom
            font-mono text-[11px] tracking-[0.22em] uppercase font-semibold
          "
        >
          Buy a voice →
        </Link>
        <Link
          to="/browse"
          data-testid="success-browse-cta"
          className="
            inline-flex items-center px-4 py-2.5 rounded-md
            bg-elev-2/60 border border-glass-soft text-silver hover:text-warm
            font-mono text-[11px] tracking-[0.22em] uppercase
          "
        >
          Browse marketplace
        </Link>
        <Link
          to="/credits"
          data-testid="success-credits-cta"
          className="
            inline-flex items-center px-4 py-2.5 rounded-md
            bg-elev-2/60 border border-glass-soft text-silver hover:text-warm
            font-mono text-[11px] tracking-[0.22em] uppercase
          "
        >
          View ledger
        </Link>
      </div>
    </section>
  );
}
