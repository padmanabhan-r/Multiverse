import type { LicenseKind, Pack } from "@multiverse-fm/shared";
import { cn } from "@/lib/cn";

export interface LicensePickerProps {
  pack: Pack;
  value: LicenseKind;
  onChange: (next: LicenseKind) => void;
}

export function LicensePicker({ pack, value, onChange }: LicensePickerProps) {
  const personalCents = pack.price_cents;
  const commercialCents = Math.round(
    pack.price_cents * (pack.license_commercial_multiplier || 1),
  );
  return (
    <div
      role="radiogroup"
      aria-label="License"
      data-testid="license-picker"
      className="grid grid-cols-1 gap-2"
    >
      <LicenseOption
        active={value === "personal"}
        onClick={() => onChange("personal")}
        title="Personal"
        subtitle="Personal projects only. No resale or commercial release."
        priceCents={personalCents}
        testId="license-personal"
      />
      <LicenseOption
        active={value === "commercial"}
        onClick={() => onChange("commercial")}
        title="Commercial"
        subtitle="Use in any commercial project — games, ads, releases."
        priceCents={commercialCents}
        testId="license-commercial"
      />
    </div>
  );
}

function LicenseOption({
  active,
  onClick,
  title,
  subtitle,
  priceCents,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
  priceCents: number;
  testId: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      data-testid={testId}
      data-active={active}
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 text-left p-3 rounded-md border transition-all duration-fast ease-tune",
        active
          ? "border-molten/50 bg-molten-tint shadow-[0_0_22px_-8px_var(--mvfm-molten-dim)]"
          : "border-glass-soft bg-elev-2/40 hover:border-glass",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 size-3.5 rounded-full border flex-shrink-0 grid place-items-center",
          active ? "border-molten" : "border-glass",
        )}
      >
        {active && (
          <span
            className="size-1.5 rounded-full bg-molten"
            style={{ boxShadow: "0 0 6px var(--mvfm-molten-glow)" }}
          />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3 mb-1">
          <span
            className={cn(
              "font-mono text-[10px] tracking-[0.22em] uppercase truncate",
              active ? "text-molten" : "text-silver",
            )}
          >
            {title}
          </span>
          <span
            className={cn(
              "font-mono text-[13px] tracking-[0.02em] font-semibold tabular-nums flex-shrink-0",
              active ? "text-warm" : "text-silver",
            )}
          >
            {formatPrice(priceCents)}
          </span>
        </div>
        <p className="text-[11.5px] text-silver2 leading-[1.4]">{subtitle}</p>
      </div>
    </button>
  );
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}
