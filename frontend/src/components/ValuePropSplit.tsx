import { Link } from "react-router-dom";

export function ValuePropSplit() {
  return (
    <section
      data-testid="value-prop-split"
      aria-label="What Multiverse is"
      className="space-y-3 sm:space-y-4"
    >
      {/* Headline + subtitle */}
      <div className="space-y-2">
        <h1
          data-testid="home-hero-headline"
          className="font-display text-warm text-[24px] sm:text-[32px] lg:text-[38px] leading-[1.05] tracking-[-0.01em]"
        >
          Production-ready audio,{" "}
          <span className="text-molten">generated and ready to ship.</span>
        </h1>
        <p className="text-silver text-[14px] sm:text-[15px] leading-[1.6] max-w-2xl">
          Buy packs of{" "}
          <b className="text-warm font-normal">sound effects</b>,{" "}
          <b className="text-warm font-normal">music</b>,{" "}
          <b className="text-warm font-normal">voice</b>,{" "}
          <b className="text-warm font-normal">ambience</b> and{" "}
          <b className="text-warm font-normal">radio</b> built by creators.
          Generate and sell your own in Studio.
        </p>
      </div>

      {/* Two-up cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <Card
          testId="value-buyer"
          overline="For buyers"
          title="Pay once. Download instantly."
          bullets={[
            "30+ ready packs across 6 categories",
            "Personal license by default · commercial 3×",
            "No subscription needed to buy",
          ]}
          cta={{ label: "Browse the marketplace", to: "/browse" }}
          plate="radial-gradient(circle at 70% 30%, rgba(255,106,31,0.20), transparent 55%), linear-gradient(165deg, #15161a 0%, #0a0a0c 100%)"
        />
        <Card
          testId="value-creator"
          overline="For creators"
          title="Generate in Studio. Set your price. Keep 70%."
          bullets={[
            "Studio generation metered by monthly credits",
            "Publish a pack in minutes — no upload mess",
            "Stripe Connect payouts — coming soon",
          ]}
          cta={{ label: "Open Studio", to: "/studio" }}
          plate="radial-gradient(circle at 30% 70%, rgba(214,168,86,0.20), transparent 55%), linear-gradient(165deg, #1a0f08 0%, #0a0506 100%)"
        />
      </div>
    </section>
  );
}

function Card({
  testId,
  overline,
  title,
  bullets,
  cta,
  plate,
}: {
  testId: string;
  overline: string;
  title: string;
  bullets: string[];
  cta: { label: string; to: string };
  plate: string;
}) {
  return (
    <article
      data-testid={testId}
      className="relative overflow-hidden rounded-xl border border-glass-soft shadow-tile p-4 sm:p-5"
      style={{ background: plate }}
    >
      <div aria-hidden className="absolute inset-0 mvfm-grain opacity-50 pointer-events-none" />
      <div className="relative space-y-3">
        <div className="font-mono text-molten text-[10px] tracking-[0.32em] uppercase">
          {overline}
        </div>
        <h3 className="font-display text-warm text-[16px] sm:text-[19px] leading-[1.2] tracking-tight">
          {title}
        </h3>
        <ul className="text-silver text-[13px] sm:text-[14px] leading-[1.6] space-y-1">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2">
              <span aria-hidden className="mt-1.5 size-1 rounded-full bg-molten flex-shrink-0" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <div className="pt-1">
          <Link
            to={cta.to}
            data-testid={`${testId}-cta`}
            style={{ color: "#1a0700" }}
            className="
              inline-flex items-center gap-2 px-3.5 py-2 rounded-md
              bg-molten hover:bg-molten-glow shadow-bloom
              font-mono text-[10.5px] tracking-[0.18em] uppercase font-semibold
              transition-colors duration-fast ease-tune
            "
          >
            {cta.label} →
          </Link>
        </div>
      </div>
    </article>
  );
}
