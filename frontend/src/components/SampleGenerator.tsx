import { useState } from "react";
import type { SampleKind } from "@multiverse/shared";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { PromptEnhanceButton } from "@/components/PromptEnhanceButton";
import { VoicePicker } from "@/components/VoicePicker";

interface Props {
  packId: string;
  kind: SampleKind;
  /** Voice packs lock voice once first sample exists. */
  lockedVoiceId: string | null;
  onLockVoice: (voiceId: string) => void;
  onGenerated: () => void;
}

const MUSIC_LENGTHS = [
  { ms: 30_000, label: "30 s" },
  { ms: 60_000, label: "60 s" },
  { ms: 90_000, label: "90 s" },
  { ms: 120_000, label: "120 s" },
] as const;

export function SampleGenerator({
  packId,
  kind,
  lockedVoiceId,
  onLockVoice,
  onGenerated,
}: Props) {
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [sfxDuration, setSfxDuration] = useState(6);
  const [sfxLoop, setSfxLoop] = useState(false);
  const [musicLen, setMusicLen] = useState(60_000);
  const [ambientDuration, setAmbientDuration] = useState(20);
  const [voiceId, setVoiceId] = useState<string | null>(lockedVoiceId);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const promptLabel: Record<SampleKind, string> = {
    sfx: "Describe the sound effect",
    music: "Describe the music track",
    voice: "What should the voice say",
    ambient: "Describe the ambient bed",
  };

  async function go() {
    setErr(null);
    if (!title.trim()) {
      setErr("Title required.");
      return;
    }
    if (!prompt.trim() && kind !== "voice") {
      setErr("Prompt required.");
      return;
    }
    setBusy(true);
    try {
      if (kind === "sfx") {
        await api.generateSfx({
          pack_id: packId,
          prompt,
          duration_seconds: sfxDuration,
          loop: sfxLoop,
          title,
        });
      } else if (kind === "music") {
        await api.generateMusic({
          pack_id: packId,
          prompt,
          music_length_ms: musicLen,
          title,
        });
      } else if (kind === "voice") {
        if (!voiceId) {
          setErr("Pick a voice first.");
          setBusy(false);
          return;
        }
        await api.generateVoice({
          pack_id: packId,
          voice_id: voiceId,
          text: prompt,
          title,
        });
        if (!lockedVoiceId) onLockVoice(voiceId);
      } else if (kind === "ambient") {
        await api.generateAmbient({
          pack_id: packId,
          prompt,
          duration_seconds: ambientDuration,
          title,
        });
      }
      setPrompt("");
      setTitle("");
      onGenerated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "generation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3" data-testid={`sample-gen-${kind}`}>
      {kind === "voice" && (
        <VoicePicker
          selectedVoiceId={voiceId}
          onSelect={(v) => {
            setVoiceId(v);
            if (lockedVoiceId === null) {
              // tentative — locked only when first generation succeeds.
            }
          }}
          locked={!!lockedVoiceId}
        />
      )}

      <div className="space-y-1">
        <label className="font-mono text-silver2 text-[10px] tracking-[0.28em] uppercase">
          {promptLabel[kind]}
        </label>
        <div className="flex gap-2 items-start">
          <textarea
            data-testid="prompt-input"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. old radio static crackling at midnight"
            className="
              flex-1 min-h-20 p-2 rounded-md bg-elev-2/60
              border border-glass-soft text-warm text-[13px]
              placeholder:text-silver/60
            "
          />
          {kind !== "voice" && (
            <PromptEnhanceButton
              value={prompt}
              kind={kind}
              onAccept={setPrompt}
            />
          )}
        </div>
      </div>

      <div className="space-y-1">
        <label className="font-mono text-silver2 text-[10px] tracking-[0.28em] uppercase">
          Sample title
        </label>
        <input
          data-testid="title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Crack 1"
          className="
            w-full p-2 rounded-md bg-elev-2/60
            border border-glass-soft text-warm text-[13px]
            placeholder:text-silver/60
          "
        />
      </div>

      {kind === "sfx" && (
        <div className="flex items-center gap-4 text-[12px] text-silver">
          <label className="flex items-center gap-2">
            <span className="font-mono text-[10px] tracking-[0.24em] uppercase text-silver2">
              Duration
            </span>
            <input
              type="range"
              min={0.5}
              max={30}
              step={0.5}
              value={sfxDuration}
              onChange={(e) => setSfxDuration(parseFloat(e.target.value))}
              data-testid="sfx-duration"
            />
            <span>{sfxDuration}s</span>
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={sfxLoop}
              onChange={(e) => setSfxLoop(e.target.checked)}
              data-testid="sfx-loop"
            />
            <span className="font-mono text-[10px] tracking-[0.24em] uppercase text-silver2">
              Loop
            </span>
          </label>
        </div>
      )}

      {kind === "music" && (
        <div className="flex gap-1" data-testid="music-length">
          {MUSIC_LENGTHS.map((m) => (
            <button
              key={m.ms}
              type="button"
              onClick={() => setMusicLen(m.ms)}
              className={cn(
                "px-2 py-1 rounded-md font-mono text-[10px] tracking-[0.22em] uppercase border",
                musicLen === m.ms
                  ? "border-molten/60 bg-molten-tint text-molten"
                  : "border-glass-soft text-silver hover:text-warm",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {kind === "ambient" && (
        <label className="flex items-center gap-2 text-[12px] text-silver">
          <span className="font-mono text-[10px] tracking-[0.24em] uppercase text-silver2">
            Duration
          </span>
          <input
            type="range"
            min={5}
            max={30}
            step={1}
            value={ambientDuration}
            onChange={(e) => setAmbientDuration(parseInt(e.target.value))}
            data-testid="ambient-duration"
          />
          <span>{ambientDuration}s loop</span>
        </label>
      )}

      {err && <div className="text-[12px] text-molten">{err}</div>}

      <button
        type="button"
        data-testid="generate-btn"
        onClick={go}
        disabled={busy}
        className="
          px-4 py-2 rounded-md bg-molten text-[11px] tracking-[0.22em]
          uppercase font-mono font-semibold disabled:opacity-40
          hover:bg-molten-glow shadow-bloom
        "
        style={{ color: "#1a0700" }}
      >
        {busy ? "Generating…" : `Generate ${kind}`}
      </button>
    </div>
  );
}
