import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { MoodChip, STUDIO_MOODS } from "@/components/MoodChip";

export type DurationSeconds = 30 | 60 | 180 | 240;
export type OutputProfile =
  | "game_ambience"
  | "radio_show"
  | "trailer"
  | "campaign_intro"
  | "story_bed";

export interface StudioPromptValue {
  prompt: string;
  moods: string[];
  duration: DurationSeconds;
  tone: number; // 0..1 (0 chaotic, 1 polished)
  profile: OutputProfile;
}

export interface StudioPromptProps {
  value?: Partial<StudioPromptValue>;
  onChange?: (v: StudioPromptValue) => void;
  onSubmit?: (v: StudioPromptValue) => void;
  disabled?: boolean;
}

const PLACEHOLDERS = [
  "a foggy 1920s detective city where rain falls upward",
  "orbital cargo haulers near Saturn, dock-bay radio",
  "a candy metropolis run by hard-boiled detectives",
];

const DURATION_LABELS: Array<{ v: DurationSeconds; label: string }> = [
  { v: 30, label: "30s" },
  { v: 60, label: "60s" },
  { v: 180, label: "3min" },
  { v: 240, label: "4min" },
];

const PROFILES: Array<{ v: OutputProfile; label: string }> = [
  { v: "game_ambience", label: "Game ambience" },
  { v: "radio_show", label: "Radio show" },
  { v: "trailer", label: "Trailer" },
  { v: "campaign_intro", label: "Campaign intro" },
  { v: "story_bed", label: "Story bed" },
];

const DEFAULTS: StudioPromptValue = {
  prompt: "",
  moods: [],
  duration: 240,
  tone: 0.5,
  profile: "radio_show",
};

export function StudioPrompt({
  value,
  onChange,
  onSubmit,
  disabled = false,
}: StudioPromptProps) {
  const [local, setLocal] = useState<StudioPromptValue>({ ...DEFAULTS, ...value });

  // Rotate placeholder until user types.
  const [phIdx, setPhIdx] = useState(0);
  useEffect(() => {
    if (local.prompt.length > 0) return;
    const t = setInterval(() => setPhIdx((i) => (i + 1) % PLACEHOLDERS.length), 4200);
    return () => clearInterval(t);
  }, [local.prompt]);

  const update = (patch: Partial<StudioPromptValue>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    onChange?.(next);
  };

  const toggleMood = (id: string) =>
    update({
      moods: local.moods.includes(id)
        ? local.moods.filter((m) => m !== id)
        : [...local.moods, id],
    });

  const canSubmit = !disabled && (local.prompt.trim().length > 0 || local.moods.length > 0);

  const charCount = local.prompt.length;
  const charsLeft = useMemo(() => Math.max(0, 240 - charCount), [charCount]);

  return (
    <form
      data-testid="studio-prompt"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit?.(local);
      }}
      className="space-y-5 sm:space-y-6"
    >
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <label
            htmlFor="studio-prompt-textarea"
            className="font-mono text-silver2 text-[9.5px] tracking-[0.22em] uppercase"
          >
            Describe a new world
          </label>
          <span
            data-testid="studio-prompt-counter"
            className="font-mono text-silver2 text-[9px] tracking-[0.18em] uppercase"
          >
            {charsLeft} chars left
          </span>
        </div>
        <textarea
          id="studio-prompt-textarea"
          data-testid="studio-prompt-textarea"
          value={local.prompt}
          onChange={(e) => update({ prompt: e.target.value.slice(0, 240) })}
          placeholder={PLACEHOLDERS[phIdx]}
          rows={3}
          maxLength={240}
          disabled={disabled}
          className="
            w-full p-4 rounded-md
            bg-elev-2/60 border border-glass-soft
            font-body text-warm text-[14px] leading-[1.5]
            placeholder:text-silver2/70 placeholder:italic
            focus:outline-none focus:border-molten/40
            focus:shadow-[0_0_24px_-8px_var(--mvfm-molten-dim)]
            transition-all duration-fast ease-tune
            resize-none
          "
        />
      </div>

      {/* Mood chip grid — 12 chips, 6 cols desktop / 4 mobile / 3 sm */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-silver2 text-[9.5px] tracking-[0.22em] uppercase">
            Mood
          </span>
          <span className="font-mono text-silver2/70 text-[9px] tracking-[0.18em] uppercase">
            {local.moods.length} / 12 selected
          </span>
        </div>
        <div
          data-testid="studio-mood-grid"
          className="grid grid-cols-4 sm:grid-cols-6 gap-2"
        >
          {STUDIO_MOODS.map((chip) => (
            <MoodChip
              key={chip.id}
              chip={chip}
              selected={local.moods.includes(chip.id)}
              onToggle={toggleMood}
              size="md"
            />
          ))}
        </div>
      </div>

      {/* Sliders / segmented controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        <ControlSection label="Duration">
          <SegmentedRow
            ariaLabel="Duration"
            options={DURATION_LABELS.map((d) => ({ value: String(d.v), label: d.label }))}
            value={String(local.duration)}
            onChange={(v) => update({ duration: Number(v) as DurationSeconds })}
            testId="studio-duration"
          />
        </ControlSection>

        <ControlSection label="Tone">
          <div className="space-y-1.5">
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(local.tone * 100)}
              onChange={(e) => update({ tone: Number(e.target.value) / 100 })}
              aria-label="Tone slider"
              data-testid="studio-tone"
              className="w-full accent-[var(--mvfm-molten)]"
            />
            <div className="flex justify-between font-mono text-silver2 text-[9px] tracking-[0.18em] uppercase">
              <span>Chaotic</span>
              <span>Polished</span>
            </div>
          </div>
        </ControlSection>

        <ControlSection label="Output profile">
          <SegmentedRow
            ariaLabel="Output profile"
            options={PROFILES.map((p) => ({ value: p.v, label: p.label }))}
            value={local.profile}
            onChange={(v) => update({ profile: v as OutputProfile })}
            stacked
            testId="studio-profile"
          />
        </ControlSection>
      </div>

      <button
        type="submit"
        data-testid="studio-lock"
        disabled={!canSubmit}
        style={
          canSubmit
            ? {
                color: "#1a0700",
                background: "var(--mvfm-molten)",
                boxShadow:
                  "0 0 0 1px rgba(255,106,31,0.7), 0 14px 36px -10px rgba(255,106,31,0.55), inset 0 1px 0 rgba(255,255,255,0.28)",
              }
            : undefined
        }
        className={cn(
          "w-full inline-flex items-center justify-center gap-2",
          "px-4 py-3 rounded-md",
          "font-mono text-[11px] tracking-[0.22em] uppercase font-semibold",
          "transition-all duration-fast ease-tune",
          canSubmit
            ? "hover:brightness-110"
            : "bg-elev-2/40 border border-glass-soft text-silver2 cursor-not-allowed",
        )}
      >
        <span
          aria-hidden
          className="block w-0 h-0"
          style={
            canSubmit
              ? {
                  borderLeft: "7px solid #1a0700",
                  borderTop: "5px solid transparent",
                  borderBottom: "5px solid transparent",
                  marginLeft: "-2px",
                }
              : undefined
          }
        />
        Lock onto a new reality
      </button>
    </form>
  );
}

function ControlSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="font-mono text-silver2 text-[9.5px] tracking-[0.22em] uppercase mb-2">
        {label}
      </div>
      {children}
    </div>
  );
}

function SegmentedRow({
  options,
  value,
  onChange,
  stacked,
  ariaLabel,
  testId,
}: {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
  stacked?: boolean;
  ariaLabel: string;
  testId: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      data-testid={testId}
      className={cn(
        "flex flex-wrap gap-1",
        stacked ? "flex-row" : "flex-row",
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            data-testid={`${testId}-${opt.value}`}
            data-active={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-3 py-1.5 rounded-md",
              "font-mono text-[10px] tracking-[0.14em] uppercase",
              "border transition-all duration-fast ease-tune",
              active
                ? "border-molten/50 bg-molten-tint text-molten"
                : "border-glass-soft bg-elev-2/40 text-silver hover:text-warm hover:border-glass",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
