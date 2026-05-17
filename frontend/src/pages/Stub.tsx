import { Link } from "react-router-dom";

export interface StubProps {
  testId: string;
  title: string;
  subtitle?: string;
  shippingIn: string;
  backTo?: { label: string; to: string };
}

/**
 * Placeholder page for V3 routes that are queued but not yet implemented.
 * Keeps the brand voice + tokens; clearly signals "coming next" so the demo
 * never lands on a blank screen.
 */
export function Stub({ testId, title, subtitle, shippingIn, backTo }: StubProps) {
  return (
    <section
      data-testid={testId}
      className="min-h-[60vh] grid place-items-center text-center px-6"
    >
      <div className="space-y-4 max-w-md">
        <div className="font-mono text-molten text-[10px] tracking-[0.32em] uppercase">
          {shippingIn}
        </div>
        <h1 className="font-display text-warm text-3xl sm:text-[40px] tracking-tight leading-[1]">
          {title}
        </h1>
        {subtitle && (
          <p className="text-silver text-[14px] leading-[1.5] max-w-prose mx-auto">
            {subtitle}
          </p>
        )}
        {backTo && (
          <div className="pt-2">
            <Link
              to={backTo.to}
              className="
                inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md
                bg-elev-2/60 border border-glass-soft text-silver hover:text-warm hover:border-glass
                font-mono text-[10.5px] tracking-[0.18em] uppercase
                transition-colors duration-fast ease-tune
              "
            >
              ← {backTo.label}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
