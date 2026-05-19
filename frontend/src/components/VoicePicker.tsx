import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  api,
  type MarketplaceVoice,
  type VoiceLibraryEntry,
} from "@/lib/api";
import { cn } from "@/lib/cn";

interface Props {
  selectedVoiceId: string | null;
  onSelect: (voiceId: string) => void;
  /** When false (i.e. already locked by a generated sample), hide tabs. */
  locked: boolean;
}

type Tab = "mine" | "library" | "clone";

export function VoicePicker({ selectedVoiceId, onSelect, locked }: Props) {
  const [tab, setTab] = useState<Tab>("mine");
  const [voices, setVoices] = useState<VoiceLibraryEntry[] | null>(null);
  const [mine, setMine] = useState<MarketplaceVoice[] | null>(null);

  useEffect(() => {
    api.listVoices().then(setVoices).catch(() => setVoices([]));
    api.listOwnedVoices().then(setMine).catch(() => setMine([]));
  }, []);

  // Default to library if there are no owned voices to surface.
  useEffect(() => {
    if (mine !== null && mine.length === 0 && tab === "mine") {
      setTab("library");
    }
  }, [mine, tab]);

  return (
    <div className="space-y-3" data-testid="voice-picker">
      {!locked && (
        <div className="flex gap-1 text-[10px] font-mono tracking-[0.22em] uppercase">
          {(["mine", "library", "clone"] as const).map((t) => (
            <button
              key={t}
              type="button"
              data-testid={`voice-tab-${t}`}
              onClick={() => setTab(t)}
              className={cn(
                "px-2 py-1 rounded-md border",
                tab === t
                  ? "text-molten border-molten/50 bg-molten-tint"
                  : "text-silver border-glass-soft hover:text-warm",
              )}
            >
              {t === "mine" ? "my voices" : t}
            </button>
          ))}
        </div>
      )}

      {tab === "mine" && (
        <div
          className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto"
          data-testid="voice-mine-list"
        >
          {mine === null && (
            <div className="text-silver text-[11px]">Loading…</div>
          )}
          {mine?.length === 0 && (
            <div className="text-silver text-[11px]">
              You haven't created or purchased any voices yet.
            </div>
          )}
          {mine?.map((v) => (
            <button
              key={v.id}
              type="button"
              data-testid={`voice-mine-${v.eleven_voice_id}`}
              onClick={() => onSelect(v.eleven_voice_id)}
              className={cn(
                "text-left p-2 rounded-md border text-[12px]",
                selectedVoiceId === v.eleven_voice_id
                  ? "border-molten/60 bg-molten-tint text-warm"
                  : "border-glass-soft text-silver hover:text-warm",
              )}
            >
              <div className="font-medium">{v.title}</div>
              {v.preview_url && (
                <audio src={v.preview_url} controls className="w-full h-7 mt-1" />
              )}
            </button>
          ))}
        </div>
      )}

      {tab === "library" && (
        <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto">
          {voices === null && <div className="text-silver text-[11px]">Loading voices…</div>}
          {voices?.length === 0 && (
            <div className="text-silver text-[11px]">No voices available.</div>
          )}
          {voices?.map((v) => (
            <button
              key={v.voice_id}
              type="button"
              data-testid={`voice-${v.voice_id}`}
              onClick={() => onSelect(v.voice_id)}
              className={cn(
                "text-left p-2 rounded-md border text-[12px]",
                selectedVoiceId === v.voice_id
                  ? "border-molten/60 bg-molten-tint text-warm"
                  : "border-glass-soft text-silver hover:text-warm",
              )}
            >
              <div className="font-medium">{v.name}</div>
              {v.preview_url && (
                <audio src={v.preview_url} controls className="w-full h-7 mt-1" />
              )}
            </button>
          ))}
        </div>
      )}

      {tab === "clone" && (
        <div className="space-y-2 p-3 rounded-md border border-glass-soft">
          <div className="text-[11px] text-silver">
            Design a brand-new voice, clone yours instantly, or train a
            professional clone — all in the voice wizard.
          </div>
          <Link
            to="/studio/voices/new"
            data-testid="voice-wizard-link"
            className="
              inline-block px-3 py-1.5 rounded-md bg-molten text-[10px]
              tracking-[0.18em] uppercase font-mono font-semibold
            "
            style={{ color: "#1a0700" }}
          >
            Create new voice…
          </Link>
        </div>
      )}
    </div>
  );
}
