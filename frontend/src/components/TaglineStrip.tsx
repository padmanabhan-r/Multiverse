/**
 * Editorial tagline strip — single huge italic Bricolage line between
 * two scan-lines. On mobile the line becomes a slow marquee so the
 * full thought reads on small viewports.
 */
export function TaglineStrip() {
  const text = "An AI-native marketplace for audio worlds.";
  return (
    <section
      data-testid="tagline-strip"
      className="py-10 sm:py-16 lg:py-20 overflow-hidden"
    >
      <div className="mvfm-scanline" aria-hidden />

      {/* Desktop / tablet: static, centered. */}
      <div className="hidden sm:flex justify-center py-10 lg:py-14">
        <p className="mvfm-display mvfm-display-tagline text-warm text-center max-w-[1100px] px-6">
          {text}
        </p>
      </div>

      {/* Mobile: horizontal marquee — repeat content twice for seamless loop. */}
      <div className="sm:hidden py-8">
        <div className="flex whitespace-nowrap mvfm-animate-marquee-fast">
          <span className="mvfm-display mvfm-display-tagline text-warm px-6">
            {text}
          </span>
          <span className="mvfm-display mvfm-display-tagline text-warm px-6">
            {text}
          </span>
        </div>
      </div>

      <div className="mvfm-scanline" aria-hidden />
    </section>
  );
}
