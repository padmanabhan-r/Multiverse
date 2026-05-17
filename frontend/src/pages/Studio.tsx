import { useEffect, useRef, useState } from "react";
import type { Station } from "@multiverse-fm/shared";
import { StudioPrompt, type StudioPromptValue } from "@/components/StudioPrompt";
import { StudioLoader, DEFAULT_STAGES } from "@/components/StudioLoader";
import { StudioReveal } from "@/components/StudioReveal";
import { usePlayer } from "@/stores/playerStore";

type StudioState =
  | { kind: "idle" }
  | { kind: "generating"; activeIdx: number; eta: number; sub: number }
  | { kind: "reveal"; station: Station };

const STAGE_MS = [1800, 1600, 4200, 3200, 2400, 2200] as const;
const TOTAL_MS = STAGE_MS.reduce((a, b) => a + b, 0);

export function Studio() {
  const [state, setState] = useState<StudioState>({ kind: "idle" });
  const cancelRef = useRef<(() => void) | null>(null);
  const play = usePlayer((s) => s.play);

  useEffect(() => () => cancelRef.current?.(), []);

  const handleSubmit = (v: StudioPromptValue) => {
    setState({ kind: "generating", activeIdx: 0, eta: Math.round(TOTAL_MS / 1000), sub: 0 });
    cancelRef.current = runStub(v, setState);
  };

  const handleCancel = () => {
    cancelRef.current?.();
    cancelRef.current = null;
    setState({ kind: "idle" });
  };

  return (
    <div data-testid="studio-page" className="space-y-6 sm:space-y-8 pb-8">
      <header className="space-y-1">
        <div className="font-mono text-silver2 text-[10px] tracking-[0.32em] uppercase">
          Studio
        </div>
        <h1 className="font-display text-warm text-3xl sm:text-[40px] tracking-tight">
          Describe a new world.
        </h1>
        <p className="text-silver text-[14px] max-w-prose">
          Generate a complete in-world radio station — music, DJ banter, ads,
          ambience — and export it as a World Pack.
        </p>
      </header>

      <section className="mvfm-glass mvfm-glass-top-edge rounded-xl p-4 sm:p-6 lg:p-8">
        {state.kind === "idle" && <StudioPrompt onSubmit={handleSubmit} />}
        {state.kind === "generating" && (
          <StudioLoader
            stages={DEFAULT_STAGES}
            activeIdx={state.activeIdx}
            etaSeconds={state.eta}
            subProgress={state.sub}
            onCancel={handleCancel}
          />
        )}
        {state.kind === "reveal" && (
          <StudioReveal
            station={state.station}
            onPlay={(id) => play(id)}
            onSave={() => undefined}
          />
        )}
      </section>

      {state.kind === "reveal" && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setState({ kind: "idle" })}
            data-testid="studio-new"
            className="
              inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md
              bg-elev-2/60 border border-glass-soft text-silver
              hover:text-warm hover:border-glass
              font-mono text-[10px] tracking-[0.22em] uppercase
              transition-colors duration-fast ease-tune
            "
          >
            Generate another
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Fake generation state machine. Real wiring lives in S8 (Architect Mode
 * backend job + WebSocket progress events).
 */
function runStub(
  v: StudioPromptValue,
  setState: React.Dispatch<React.SetStateAction<StudioState>>,
): () => void {
  let cancelled = false;
  const start = Date.now();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const TICK_MS = 80;

  const tick = () => {
    if (cancelled) return;
    const elapsed = Date.now() - start;
    if (elapsed >= TOTAL_MS) {
      setState({ kind: "reveal", station: synthStation(v) });
      return;
    }
    let acc = 0;
    let idx = 0;
    for (let i = 0; i < STAGE_MS.length; i++) {
      if (elapsed < acc + STAGE_MS[i]) {
        idx = i;
        break;
      }
      acc += STAGE_MS[i];
    }
    const sub = (elapsed - acc) / STAGE_MS[idx];
    const eta = Math.max(0, Math.round((TOTAL_MS - elapsed) / 1000));
    setState({ kind: "generating", activeIdx: idx, eta, sub });
    timer = setTimeout(tick, TICK_MS);
  };

  timer = setTimeout(tick, TICK_MS);

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}

/**
 * Build a faux Station from the prompt value.
 * Real generator lives in backend (Anthropic + Eleven Music + voice + mix).
 */
function synthStation(v: StudioPromptValue): Station {
  const seed = v.prompt || v.moods.join(" ");
  const id = `studio_${hash(seed).toString(36)}`;
  const moodLabel = v.moods.length > 0 ? v.moods.join(", ") : "open";
  return {
    id,
    station_name: titleFromPrompt(v.prompt || moodLabel),
    reality_type: "fictional",
    year_or_era: "drafted",
    place: "User-defined",
    broadcast_format: profileLabel(v.profile),
    dj_persona: "Auto-cast DJ — generated identity, awaits naming",
    language_register: "synthesised",
    music_blueprint: { moods: v.moods, duration_s: v.duration, tone: v.tone },
    ad_economy: ["placeholder sponsor"],
    headline_style: "synthetic bulletin layer",
    weather_style: "synthetic atmospheric layer",
    ambient_palette: v.moods.length > 0 ? v.moods : ["ambient"],
    signal_texture: "studio synth",
    station_slogan: v.prompt
      ? truncate(v.prompt, 120)
      : "Locked onto a new reality.",
    dj_voice_id: "",
    mastering_preset: "pirate_neon",
    tier_required: "architect",
    card_art_url: null,
    hero_art_url: null,
  };
}

function profileLabel(p: StudioPromptValue["profile"]): string {
  switch (p) {
    case "game_ambience":
      return "game ambience bed";
    case "radio_show":
      return "radio show, full-length";
    case "trailer":
      return "cinematic trailer cue";
    case "campaign_intro":
      return "campaign intro reel";
    case "story_bed":
      return "long-form story bed";
  }
}

function titleFromPrompt(prompt: string): string {
  const head = prompt.split(/[.,;\n]/)[0].trim().slice(0, 48);
  return head.length > 0 ? capitalize(head) : "Untitled world";
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0;
  return h;
}
