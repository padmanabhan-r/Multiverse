import { cn } from "@/lib/cn";

export type StageKey =
  | "bible"
  | "run_sheet"
  | "music"
  | "voices"
  | "ambience"
  | "mix";

export interface StudioLoaderProps {
  stages: ReadonlyArray<{ key: StageKey; label: string }>;
  /** Currently-active stage index (one in flight). -1 = none yet. */
  activeIdx: number;
  /** Estimated seconds remaining. Pass null to hide. */
  etaSeconds?: number | null;
  /** Optional sub-progress within the active stage (0..1) for the bar. */
  subProgress?: number;
  onCancel?: () => void;
}

export const DEFAULT_STAGES: ReadonlyArray<{ key: StageKey; label: string }> = [
  { key: "bible", label: "Drafting world bible" },
  { key: "run_sheet", label: "Writing run sheet" },
  { key: "music", label: "Composing music" },
  { key: "voices", label: "Tracking DJ voice" },
  { key: "ambience", label: "Layering ambience" },
  { key: "mix", label: "Mixing block" },
];

export function StudioLoader({
  stages,
  activeIdx,
  etaSeconds = null,
  subProgress = 0,
  onCancel,
}: StudioLoaderProps) {
  return (
    <div
      data-testid="studio-loader"
      className="flex flex-col lg:flex-row items-center lg:items-start gap-8 lg:gap-12 py-6"
    >
      {/* Concentric ring loader */}
      <div
        data-testid="studio-ring"
        className="relative size-[200px] sm:size-[280px] flex-shrink-0 grid place-items-center"
      >
        {[1, 2, 3, 4].map((n) => (
          <span
            key={n}
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 40 + n * 50,
              height: 40 + n * 50,
              border: `1px solid rgba(255,106,31,${0.32 - n * 0.06})`,
              animation: `mvfm-pulse-ring ${3 + n}s ease-in-out infinite`,
              animationDelay: `${n * 0.2}s`,
            }}
          />
        ))}

        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 size-full"
          aria-hidden
        >
          <defs>
            <linearGradient id="ring-arc" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--mvfm-molten-glow)" stopOpacity="0" />
              <stop offset="100%" stopColor="var(--mvfm-molten)" stopOpacity="1" />
            </linearGradient>
          </defs>
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="url(#ring-arc)"
            strokeWidth="1.2"
            strokeDasharray="80 200"
            strokeLinecap="round"
            style={{
              transformOrigin: "center",
              animation: "mvfm-spin-cw 6s linear infinite",
            }}
          />
          <circle
            cx="50"
            cy="50"
            r="34"
            fill="none"
            stroke="var(--mvfm-molten)"
            strokeWidth="0.8"
            strokeDasharray="40 160"
            strokeLinecap="round"
            opacity="0.7"
            style={{
              transformOrigin: "center",
              animation: "mvfm-spin-ccw 9s linear infinite",
            }}
          />
          <circle
            cx="50"
            cy="50"
            r="24"
            fill="none"
            stroke="var(--mvfm-molten-glow)"
            strokeWidth="0.6"
            strokeDasharray="20 80"
            opacity="0.5"
            style={{
              transformOrigin: "center",
              animation: "mvfm-spin-cw 14s linear infinite",
            }}
          />
        </svg>

        <span
          className="size-2 rounded-full bg-molten"
          style={{ boxShadow: "0 0 18px var(--mvfm-molten-glow)" }}
        />
      </div>

      <div className="flex-1 w-full max-w-md">
        <div className="font-mono text-silver2 text-[9.5px] tracking-[0.22em] uppercase mb-3">
          Locking onto new reality
        </div>

        <ol data-testid="studio-stages" className="flex flex-col gap-1.5">
          {stages.map((stage, i) => {
            const done = i < activeIdx;
            const active = i === activeIdx;
            return (
              <li
                key={stage.key}
                data-testid={`studio-stage-${stage.key}`}
                data-state={done ? "done" : active ? "active" : "pending"}
                className={cn(
                  "flex items-center gap-3 px-2.5 py-2 rounded-md",
                  active && "bg-molten-tint",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-4 rounded-pill flex-shrink-0 border grid place-items-center",
                    done && "bg-molten border-molten",
                    active && "border-molten",
                    !done && !active && "border-glass-soft",
                  )}
                  style={
                    active
                      ? { boxShadow: "0 0 10px var(--mvfm-molten-dim)" }
                      : undefined
                  }
                >
                  {done && (
                    <svg viewBox="0 0 12 12" fill="none" className="size-2.5">
                      <path
                        d="M2.5 6.5L4.8 8.6 9.3 3.8"
                        stroke="#1a0700"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                  {active && <span className="size-1.5 rounded-full bg-molten" />}
                </span>
                <span
                  className={cn(
                    "flex-1 truncate",
                    "font-body text-[13.5px] leading-[1.4]",
                    done && "text-silver2 line-through decoration-silver2/50",
                    active && "text-warm font-medium",
                    !done && !active && "text-silver",
                  )}
                >
                  {stage.label}
                </span>
                <span
                  className={cn(
                    "font-mono text-[9.5px] tracking-[0.14em] uppercase",
                    done && "text-molten",
                    active && "text-molten",
                    !done && !active && "text-silver2",
                  )}
                >
                  {done ? "done" : active ? "…" : "queued"}
                </span>
              </li>
            );
          })}
        </ol>

        {activeIdx >= 0 && activeIdx < stages.length && (
          <div className="mt-3" data-testid="studio-subprogress">
            <div className="h-0.5 w-full rounded-pill bg-white/[0.06] overflow-hidden">
              <div
                className="h-full bg-molten"
                style={{
                  width: `${Math.max(0, Math.min(1, subProgress)) * 100}%`,
                  transition: "width 480ms var(--mvfm-ease)",
                  boxShadow: "0 0 10px var(--mvfm-molten-glow)",
                }}
              />
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between">
          <span
            data-testid="studio-eta"
            className="font-mono text-silver2 text-[10px] tracking-[0.18em] uppercase tabular-nums"
          >
            {etaSeconds == null
              ? "—"
              : `~ ${Math.max(0, Math.round(etaSeconds))} s remaining`}
          </span>
          {onCancel && (
            <button
              type="button"
              data-testid="studio-cancel"
              onClick={onCancel}
              className="
                px-3 py-1.5 rounded-md
                bg-elev-2/40 border border-glass-soft
                font-mono text-[10px] tracking-[0.18em] uppercase
                text-silver hover:text-warm hover:border-glass
                transition-colors duration-fast ease-tune
              "
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
