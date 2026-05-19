import { Link } from "react-router-dom";

export function BillingCancel() {
  return (
    <section
      className="space-y-5 pb-8 max-w-2xl"
      data-testid="billing-cancel-page"
    >
      <header className="space-y-2">
        <div className="font-mono text-silver2 text-[10px] tracking-[0.32em] uppercase">
          Checkout cancelled
        </div>
        <h1 className="mvfm-display text-warm text-[36px] sm:text-[48px] leading-[0.95]">
          No charge made.
        </h1>
        <p className="text-silver text-[14px] max-w-prose">
          You stepped back before completing the Stripe checkout. Your card was
          not charged. Pick a top-up again anytime — or keep browsing.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Link
          to="/credits"
          data-testid="cancel-retry-cta"
          style={{ color: "#1a0700" }}
          className="
            inline-flex items-center px-4 py-2.5 rounded-md
            bg-molten hover:bg-molten-glow shadow-bloom
            font-mono text-[11px] tracking-[0.22em] uppercase font-semibold
          "
        >
          Back to top-ups
        </Link>
        <Link
          to="/browse"
          className="
            inline-flex items-center px-4 py-2.5 rounded-md
            bg-elev-2/60 border border-glass-soft text-silver hover:text-warm
            font-mono text-[11px] tracking-[0.22em] uppercase
          "
        >
          Browse marketplace
        </Link>
      </div>
    </section>
  );
}
