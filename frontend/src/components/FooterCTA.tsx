import { Link } from "react-router-dom";

/**
 * Closing CTA band — two huge stacked Bricolage links. Each link has a
 * baseline mono caption. Section sandwiched by scan-lines.
 */
export function FooterCTA() {
  return (
    <section data-testid="footer-cta" className="py-12 sm:py-16">
      <div className="mvfm-scanline mb-10" aria-hidden />
      <div className="space-y-8 sm:space-y-10">
        <CTARow
          to="/studio"
          headline="Make something."
          caption="Generate a pack from scratch — SFX, music, voice or ambient."
          testId="footer-cta-studio"
        />
        <CTARow
          to="/browse"
          headline="Browse the catalog."
          caption="Thousands of royalty-free AI-generated sounds — sold by AI-native creators."
          testId="footer-cta-browse"
        />
      </div>
      <div className="mvfm-scanline mt-10" aria-hidden />
    </section>
  );
}

interface RowProps {
  to: string;
  headline: string;
  caption: string;
  testId: string;
}

function CTARow({ to, headline, caption, testId }: RowProps) {
  return (
    <Link
      to={to}
      data-testid={testId}
      className="group block"
    >
      <div className="mvfm-display text-warm text-[28px] sm:text-[40px] lg:text-[52px] leading-[0.95] transition-colors duration-tune ease-tune group-hover:text-molten">
        {headline}
        <span
          aria-hidden
          className="inline-block ml-3 text-molten translate-x-0 transition-transform duration-tune ease-tune group-hover:translate-x-2"
        >
          →
        </span>
      </div>
      <div className="font-mono text-silver2 text-[10px] sm:text-[11px] tracking-[0.22em] uppercase mt-2">
        {caption}
      </div>
    </Link>
  );
}
