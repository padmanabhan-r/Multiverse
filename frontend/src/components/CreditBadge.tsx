import { Link } from "react-router-dom";
import { cn } from "@/lib/cn";

export interface CreditBadgeProps {
  /** Current balance. */
  balance: number;
  /** Tier monthly grant (defines the denominator). 0 = free tier → render as upgrade pill. */
  tierGrant: number;
}

/**
 * Topbar badge that doubles as upgrade CTA for free users.
 *  - Free tier → "Subscribe" pill linking to /pricing
 *  - Paid tier → "N ⚡" balance pill linking to /pricing (for plan view)
 */
export function CreditBadge({ balance, tierGrant }: CreditBadgeProps) {
  const subscribed = tierGrant > 0;
  // Show numeric balance if user has any credits — covers free trial (5 one-time).
  const showBalance = subscribed || balance > 0;
  const low = showBalance && balance <= 2;

  return (
    <Link
      to="/pricing"
      data-testid="credit-badge"
      data-state={subscribed ? (low ? "low" : "ok") : "free"}
      className={cn(
        "hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill",
        "font-mono text-[10px] tracking-[0.22em] uppercase",
        "border transition-colors duration-fast ease-tune",
        showBalance
          ? low
            ? "bg-elev-2/60 border-molten/40 text-molten hover:bg-molten-tint"
            : "bg-elev-2/60 border-glass-soft text-warm hover:border-glass"
          : "bg-elev-2/60 border-glass-soft text-silver hover:text-warm hover:border-glass",
      )}
      aria-label={
        subscribed
          ? `${balance} of ${tierGrant} Studio credits remaining`
          : "Subscribe for Studio credits"
      }
    >
      {showBalance ? (
        <>
          <Bolt />
          <span data-testid="credit-badge-balance" className="tabular-nums">
            {balance}
          </span>
        </>
      ) : (
        <>
          <Bolt />
          <span>Free</span>
        </>
      )}
    </Link>
  );
}

function Bolt() {
  return (
    <svg viewBox="0 0 10 10" fill="currentColor" aria-hidden className="size-2.5">
      <path d="M5.5 0L0.5 6h3l-1 4 5-6h-3l1-4z" />
    </svg>
  );
}
