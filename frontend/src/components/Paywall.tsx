import type { Tier } from "@multiverse/shared";
import { type ReactNode } from "react";

const RANK: Record<Tier, number> = { free: 0, explorer: 1, architect: 2 };

export interface PaywallProps {
  currentTier: Tier;
  requires: Tier;
  children: ReactNode;
  onUpgrade?: (tier: Tier) => void;
  fallback?: ReactNode;
}

export function Paywall({ currentTier, requires, children, onUpgrade, fallback }: PaywallProps) {
  const ok = RANK[currentTier] >= RANK[requires];
  if (ok) return <>{children}</>;
  if (fallback) return <>{fallback}</>;
  return (
    <div
      role="alert"
      data-testid="paywall-block"
      className="rounded-xl border border-white/5 bg-elev-2/60 backdrop-blur-panel p-6 text-center shadow-panel"
    >
      <p className="font-display text-sm tracking-widest text-silver uppercase">Signal locked</p>
      <p className="mt-2 text-warm">
        Tune the <span className="text-molten">{requires}</span> band to unlock this reality.
      </p>
      <button
        type="button"
        onClick={() => onUpgrade?.(requires)}
        className="mt-4 px-6 py-2 rounded-full bg-molten/90 hover:bg-molten text-base text-warm font-display text-sm tracking-widest shadow-bloom transition-colors duration-200 ease-tune"
      >
        Upgrade to {requires}
      </button>
    </div>
  );
}
