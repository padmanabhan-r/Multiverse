import { useState } from "react";
import { api } from "@/lib/api";

interface Props {
  packId: string;
  currentUrl: string | null;
  currentHeroUrl?: string | null;
  onChange: (url: string) => void;
  onHeroChange?: (url: string) => void;
}

export function CoverArtPicker({
  packId,
  currentUrl,
  currentHeroUrl,
  onChange,
  onHeroChange,
}: Props) {
  const [busyKind, setBusyKind] = useState<"cover" | "hero" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function regenCover() {
    setBusyKind("cover");
    setErr(null);
    try {
      const out = await api.generateCover(packId);
      onChange(`${out.cover_art_url}?t=${Date.now()}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "cover gen failed");
    } finally {
      setBusyKind(null);
    }
  }

  async function regenHero() {
    setBusyKind("hero");
    setErr(null);
    try {
      const out = await api.generateHero(packId);
      onHeroChange?.(`${out.hero_art_url}?t=${Date.now()}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "hero gen failed");
    } finally {
      setBusyKind(null);
    }
  }

  return (
    <div className="space-y-3" data-testid="cover-picker">
      <div className="aspect-square w-full max-w-[240px] rounded-lg overflow-hidden bg-elev-2/60 border border-glass-soft">
        {currentUrl ? (
          <img
            src={currentUrl}
            alt="Pack cover"
            data-testid="cover-img"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-silver text-[11px]">
            No cover yet
          </div>
        )}
      </div>
      <button
        type="button"
        data-testid="cover-regen"
        onClick={regenCover}
        disabled={busyKind !== null}
        className="
          w-full px-3 py-1.5 rounded-md bg-elev-2/60 border border-glass-soft
          text-silver hover:text-warm font-mono text-[10px]
          tracking-[0.22em] uppercase disabled:opacity-40
        "
      >
        {busyKind === "cover" ? "Generating…" : currentUrl ? "Regenerate cover" : "✦ Generate cover"}
      </button>

      {/* Hero plate (16:9 cinematic). Free in v1. */}
      <div className="pt-2 border-t border-glass-soft space-y-2">
        <div className="font-mono text-silver2 text-[9px] tracking-[0.28em] uppercase">
          Cinematic hero plate
        </div>
        {currentHeroUrl ? (
          <img
            src={currentHeroUrl}
            alt="Pack hero plate"
            data-testid="hero-img"
            className="w-full aspect-[16/9] rounded-md object-cover border border-glass-soft"
          />
        ) : (
          <div className="w-full aspect-[16/9] rounded-md bg-elev-2/60 border border-glass-soft grid place-items-center text-silver text-[11px]">
            No hero plate yet
          </div>
        )}
        <button
          type="button"
          data-testid="hero-regen"
          onClick={regenHero}
          disabled={busyKind !== null}
          className="
            w-full px-3 py-1.5 rounded-md bg-elev-2/60 border border-glass-soft
            text-silver hover:text-warm font-mono text-[10px]
            tracking-[0.22em] uppercase disabled:opacity-40
          "
        >
          {busyKind === "hero"
            ? "Generating…"
            : currentHeroUrl
              ? "Regenerate hero"
              : "✦ Generate hero plate"}
        </button>
      </div>

      {err && <div className="text-[11px] text-molten">{err}</div>}
    </div>
  );
}
