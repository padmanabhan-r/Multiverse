import type { ReactNode } from "react";

interface Props {
  eyebrow: string;
  /** Optional right-side eyebrow (e.g. "12 packs"). */
  right?: string;
  /** Optional headline rendered in display font under the scan-line. */
  children?: ReactNode;
}

/**
 * Section header: small mono eyebrow on the left, optional right-eyebrow,
 * a 1px molten scan-line beneath, then optional headline children.
 * Used at the top of every editorial section on Home.
 */
export function EditorialEyebrow({ eyebrow, right, children }: Props) {
  return (
    <header className="mb-6 sm:mb-8">
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <span className="font-mono text-silver2 text-[10px] tracking-[0.32em] uppercase">
          {eyebrow}
        </span>
        {right && (
          <span className="font-mono text-silver2 text-[10px] tracking-[0.22em] uppercase">
            {right}
          </span>
        )}
      </div>
      <div className="mvfm-scanline" aria-hidden />
      {children && (
        <h2 className="mvfm-display mvfm-display-section text-warm mt-4">
          {children}
        </h2>
      )}
    </header>
  );
}
