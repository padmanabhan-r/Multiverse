import { Link } from "react-router-dom";
import { cn } from "@/lib/cn";

interface Tier {
  key: string;
  name: string;
  price: string;
  period: string;
  credits: string;
  features: string[];
  cta: string;
  ctaTestId: string;
  highlight: boolean;
}

const TIERS: Tier[] = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    credits: "5 trial Studio credits — one time",
    features: [
      "Browse the full marketplace",
      "Buy packs with a card (no sub needed)",
      "5 one-time Studio credits to try generation",
      "Personal license on purchases",
    ],
    cta: "Get started",
    ctaTestId: "cta-free",
    highlight: false,
  },
  {
    key: "creator",
    name: "Creator",
    price: "$9",
    period: "/ mo",
    credits: "20 Studio credits / month",
    features: [
      "Everything in Free",
      "20 Studio credits every month",
      "Publish unlimited packs to marketplace",
      "Personal license on your own packs",
      "Creator dashboard + sales analytics",
    ],
    cta: "Subscribe",
    ctaTestId: "cta-creator",
    highlight: false,
  },
  {
    key: "pro-studio",
    name: "Pro Studio",
    price: "$29",
    period: "/ mo",
    credits: "80 Studio credits / month",
    features: [
      "Everything in Creator",
      "80 Studio credits every month",
      "Commercial license on your own generated packs",
      "Priority generation queue",
      "Bundle creation (group packs + sell as a set)",
    ],
    cta: "Subscribe",
    ctaTestId: "cta-pro-studio",
    highlight: true,
  },
];

const CREDIT_COSTS = [
  { category: "Sound effects (SFX)", credits: 1 },
  { category: "Voice packs", credits: 2 },
  { category: "Ambient beds", credits: 2 },
  { category: "Music packs", credits: 3 },
  { category: "Radio packs", credits: 3 },
  { category: "Broadcast packs", credits: 3 },
];

export function Pricing() {
  return (
    <section data-testid="page-pricing" className="max-w-5xl mx-auto space-y-16 py-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="font-mono text-silver2 text-[10px] tracking-[0.32em] uppercase">
          Simple pricing
        </div>
        <h1 className="font-display text-warm text-[36px] sm:text-[48px] leading-[1.02] tracking-[-0.01em]">
          Buy anything.{" "}
          <span className="text-molten">Subscribe to create.</span>
        </h1>
        <p className="text-silver text-[15px] leading-[1.6] max-w-xl mx-auto">
          Anyone can buy packs with a card — no subscription needed. Studio
          generation is metered by credits, granted monthly with a Creator plan.
        </p>
      </div>

      {/* Tier cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {TIERS.map((tier) => (
          <div
            key={tier.key}
            data-testid={`tier-${tier.key}`}
            className={cn(
              "relative flex flex-col rounded-xl border p-6 gap-5",
              "transition-colors duration-fast ease-tune",
              tier.highlight
                ? "border-molten/40 bg-molten-tint shadow-[0_0_40px_-12px_var(--mvfm-molten-dim)]"
                : "border-glass-soft bg-elev-2/40",
            )}
          >
            {tier.highlight && (
              <span
                className="
                  absolute -top-3 left-1/2 -translate-x-1/2
                  px-3 py-0.5 rounded-pill
                  bg-molten font-mono text-[8px] tracking-[0.22em] uppercase font-semibold
                "
                style={{ color: "#1a0700" }}
              >
                Most popular
              </span>
            )}

            {/* Tier name + price */}
            <div>
              <div
                className={cn(
                  "font-mono text-[10px] tracking-[0.28em] uppercase mb-2",
                  tier.highlight ? "text-molten" : "text-silver",
                )}
              >
                {tier.name}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-display text-warm text-[40px] leading-none">
                  {tier.price}
                </span>
                <span className="font-mono text-silver text-[11px] tracking-[0.1em]">
                  {tier.period}
                </span>
              </div>
              <div className="mt-2 font-mono text-silver2 text-[10.5px] tracking-[0.04em]">
                {tier.credits}
              </div>
            </div>

            {/* Features */}
            <ul className="flex-1 space-y-2">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-[13px] text-silver leading-[1.4]">
                  <span className="mt-0.5 size-3.5 rounded-full border border-molten/40 flex-shrink-0 grid place-items-center">
                    <span className="size-1.5 rounded-full bg-molten" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            {/* CTA */}
            <button
              type="button"
              data-testid={tier.ctaTestId}
              className={cn(
                "w-full py-2.5 rounded-pill font-mono text-[10.5px] tracking-[0.18em] uppercase font-semibold",
                "transition-colors duration-fast ease-tune",
                tier.highlight
                  ? "bg-molten hover:bg-molten-glow shadow-bloom"
                  : "bg-elev-2/60 border border-glass-soft text-silver hover:text-warm hover:border-glass",
              )}
              style={tier.highlight ? { color: "#1a0700" } : undefined}
            >
              {tier.cta}
            </button>
          </div>
        ))}
      </div>

      {/* Credit cost legend */}
      <div
        data-testid="credit-legend"
        className="rounded-xl border border-glass-soft bg-elev-2/30 p-6 space-y-4"
      >
        <h2 className="font-mono text-warm text-[11px] tracking-[0.28em] uppercase">
          Studio credit costs
        </h2>
        <p className="text-silver text-[13px] leading-[1.5]">
          Credits reset monthly — no rollover. Unused credits expire at the end of
          your billing cycle.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {CREDIT_COSTS.map(({ category, credits }) => (
            <div
              key={category}
              className="flex items-center justify-between gap-4 px-3 py-2 rounded-md bg-elev-2/40 border border-glass-soft"
            >
              <span className="text-silver text-[13px]">{category}</span>
              <span className="font-mono text-molten text-[11px] tracking-[0.1em] flex-shrink-0">
                {credits} credit{credits > 1 ? "s" : ""}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 70/30 marketplace fee */}
      <div
        data-testid="marketplace-fee"
        className="rounded-xl border border-glass-soft bg-elev-2/30 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4"
      >
        <div className="flex-1 space-y-1">
          <h2 className="font-mono text-warm text-[11px] tracking-[0.28em] uppercase">
            Creator earnings
          </h2>
          <p className="text-silver text-[13px] leading-[1.5]">
            Creators keep <span className="text-warm font-semibold">70%</span> of every sale.
            Multiverse keeps 30% to cover hosting, Studio compute, and ElevenLabs generation costs.
            No platform lock-in — your packs, your prices.
          </p>
        </div>
        <div className="flex-shrink-0 text-center">
          <div className="font-display text-molten text-[48px] leading-none">70%</div>
          <div className="font-mono text-silver2 text-[9px] tracking-[0.22em] uppercase mt-1">
            to you
          </div>
        </div>
      </div>

      {/* Stripe Connect coming soon */}
      <div
        data-testid="connect-soon"
        className="rounded-xl border border-glass-soft bg-elev-2/20 p-5 flex items-center gap-4"
      >
        <div className="size-8 rounded-md bg-elev-2/60 border border-glass-soft grid place-items-center flex-shrink-0">
          <svg viewBox="0 0 16 16" fill="none" className="size-4 text-silver">
            <rect x="1" y="4" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M1 7h14" stroke="currentColor" strokeWidth="1.3" />
            <circle cx="4.5" cy="10.5" r="1" fill="currentColor" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-warm text-[10.5px] tracking-[0.18em] uppercase">
            Creator payouts via Stripe Connect — coming soon
          </div>
          <div className="text-silver2 text-[12px] mt-0.5">
            Payouts are being tracked now. Direct bank transfer via Stripe Express
            Connect ships next. You won't lose a cent.
          </div>
        </div>
        <span className="flex-shrink-0 px-2 py-0.5 rounded-pill border border-glass-soft font-mono text-[9px] tracking-[0.18em] uppercase text-silver2">
          Roadmap
        </span>
      </div>

      {/* Back CTA */}
      <div className="text-center pb-4">
        <Link
          to="/browse"
          className="
            inline-flex items-center gap-1.5 px-4 py-2 rounded-md
            bg-elev-2/60 border border-glass-soft text-silver hover:text-warm hover:border-glass
            font-mono text-[10.5px] tracking-[0.18em] uppercase
            transition-colors duration-fast ease-tune
          "
        >
          ← Browse the marketplace
        </Link>
      </div>
    </section>
  );
}
