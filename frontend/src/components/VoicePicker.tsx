import { useEffect, useState } from "react";
import { api, type VoiceLibraryEntry } from "@/lib/api";
import { cn } from "@/lib/cn";

interface Props {
  selectedVoiceId: string | null;
  onSelect: (voiceId: string) => void;
  /** When false (i.e. already locked by a generated sample), hide tabs. */
  locked: boolean;
}

export function VoicePicker({ selectedVoiceId, onSelect, locked }: Props) {
  const [tab, setTab] = useState<"library" | "design">("library");
  const [voices, setVoices] = useState<VoiceLibraryEntry[] | null>(null);
  const [designPrompt, setDesignPrompt] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.listVoices().then(setVoices).catch(() => setVoices([]));
  }, []);

  async function design() {
    if (!designPrompt.trim()) return;
    setBusy(true);
    try {
      const out = await api.designVoice({
        prompt: designPrompt.trim(),
        name: "Custom",
      });
      onSelect(out.voice_id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3" data-testid="voice-picker">
      {!locked && (
        <div className="flex gap-1 text-[10px] font-mono tracking-[0.22em] uppercase">
          {(["library", "design"] as const).map((t) => (
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
              {t}
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

      {tab === "design" && (
        <div className="space-y-2">
          <textarea
            data-testid="voice-design-prompt"
            value={designPrompt}
            onChange={(e) => setDesignPrompt(e.target.value)}
            placeholder="e.g. gravelly noir narrator, late 40s, smoky"
            className="
              w-full min-h-16 p-2 rounded-md bg-elev-2/60
              border border-glass-soft text-warm text-[12px]
              placeholder:text-silver/60
            "
          />
          <button
            type="button"
            data-testid="voice-design-submit"
            onClick={design}
            disabled={busy || !designPrompt.trim()}
            className="
              px-3 py-1.5 rounded-md bg-molten text-[10px] tracking-[0.18em]
              uppercase font-mono font-semibold disabled:opacity-40
            "
            style={{ color: "#1a0700" }}
          >
            {busy ? "Designing…" : "Design voice"}
          </button>
          <div className="text-[10px] text-silver2 italic">
            v1 returns a premade voice. Full Voice Design lands later.
          </div>
        </div>
      )}
    </div>
  );
}
