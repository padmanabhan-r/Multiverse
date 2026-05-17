import { useState } from "react";
import { api } from "@/lib/api";

interface Props {
  packId: string;
  currentUrl: string | null;
  onChange: (url: string) => void;
}

export function CoverArtPicker({ packId, currentUrl, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function regen() {
    setBusy(true);
    setErr(null);
    try {
      const out = await api.generateCover(packId);
      // Bust browser cache by appending ts
      const url = `${out.cover_art_url}?t=${Date.now()}`;
      onChange(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "cover gen failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2" data-testid="cover-picker">
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
        onClick={regen}
        disabled={busy}
        className="
          px-3 py-1.5 rounded-md bg-elev-2/60 border border-glass-soft
          text-silver hover:text-warm font-mono text-[10px]
          tracking-[0.22em] uppercase disabled:opacity-40
        "
      >
        {busy ? "Generating…" : currentUrl ? "Regenerate cover" : "✦ Generate cover"}
      </button>
      {err && <div className="text-[11px] text-molten">{err}</div>}
    </div>
  );
}
