import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PackCategory, SampleKind } from "@multiverse-fm/shared";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";

interface CategoryCard {
  category: PackCategory;
  sampleKind: SampleKind | null;
  label: string;
  blurb: string;
  cost: string;
  enabled: boolean;
}

const CATEGORIES: CategoryCard[] = [
  {
    category: "sfx",
    sampleKind: "sfx",
    label: "Sound effects",
    blurb: "Generate one SFX at a time. Each sample 0.5–30 s.",
    cost: "1 credit / sample",
    enabled: true,
  },
  {
    category: "music",
    sampleKind: "music",
    label: "Music",
    blurb: "Instrumental tracks 30–120 s, force-instrumental.",
    cost: "2 credits / track",
    enabled: true,
  },
  {
    category: "voice_packs",
    sampleKind: "voice",
    label: "Voice pack",
    blurb: "Pick one voice. Generate lines 1-by-1.",
    cost: "1 credit / line",
    enabled: true,
  },
  {
    category: "ambient",
    sampleKind: "ambient",
    label: "Ambient",
    blurb: "Loopable 5–30 s beds for games + scenes.",
    cost: "1 credit / bed",
    enabled: true,
  },
  {
    category: "radio_packs",
    sampleKind: null,
    label: "Radio pack",
    blurb: "Full multi-segment stations.",
    cost: "Coming soon",
    enabled: false,
  },
  {
    category: "broadcast_packs",
    sampleKind: null,
    label: "Broadcast pack",
    blurb: "Hour-long broadcast blocks.",
    cost: "Coming soon",
    enabled: false,
  },
];

export function StudioNew() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start(card: CategoryCard) {
    if (!card.enabled) return;
    setBusy(true);
    setErr(null);
    try {
      const draft = await api.createDraft({
        title: `Untitled ${card.label} pack`,
        category: card.category,
        description: "",
        price_cents: 200,
        tags: [],
        moods: [],
        license_commercial_multiplier: 3,
        style_profile: { sample_kind: card.sampleKind },
      });
      nav(`/studio/draft/${draft.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "create failed");
      setBusy(false);
    }
  }

  return (
    <section className="space-y-6 sm:space-y-8 pb-8" data-testid="studio-new">
      <header className="space-y-1">
        <div className="font-mono text-silver2 text-[10px] tracking-[0.32em] uppercase">
          Studio · New pack
        </div>
        <h1 className="font-display text-warm text-3xl sm:text-[40px] tracking-tight">
          Pick a pack type.
        </h1>
        <p className="text-silver text-[14px] max-w-prose">
          You'll generate samples one by one. Set price + cover at the end.
        </p>
      </header>

      {err && <div className="text-molten text-[12px]">{err}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {CATEGORIES.map((c) => (
          <button
            key={c.category}
            type="button"
            disabled={!c.enabled || busy}
            data-testid={`cat-${c.category}`}
            onClick={() => start(c)}
            className={cn(
              "text-left p-4 rounded-lg border transition-colors",
              c.enabled
                ? "border-glass-soft bg-elev-2/60 hover:border-molten/40 hover:bg-molten-tint/40"
                : "border-glass-soft/30 bg-elev-2/30 opacity-50 cursor-not-allowed",
            )}
          >
            <div className="font-display text-warm text-lg">{c.label}</div>
            <div className="text-silver text-[12px] mt-1">{c.blurb}</div>
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-silver2 mt-2">
              {c.cost}
              {!c.enabled && <span className="ml-2 text-molten">[soon]</span>}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
