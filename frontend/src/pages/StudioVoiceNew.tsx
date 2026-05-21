import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  api,
  ApiError,
  type CreatedVoice,
  type DesignPreviewItem,
  type VoiceCloneJob,
} from "@/lib/api";
import { cn } from "@/lib/cn";
import { AudioDropZone } from "@/components/voicepack/AudioDropZone";
import { MicRecorder } from "@/components/voicepack/MicRecorder";
import { PromptEnhanceButton } from "@/components/PromptEnhanceButton";

type Method = "design" | "ivc" | "pvc";
type Step = "method" | "capture" | "previews" | "fork" | "job";
type PublishKind = "private" | "marketplace_draft";

const SESSION_KEY = "multiverse:voice-design-previews";

interface CachedDesign {
  prompt: string;
  name: string;
  description: string;
  previews: DesignPreviewItem[];
  selectedId: string | null;
  ts: number;
}

function loadCached(): CachedDesign | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const out = JSON.parse(raw) as CachedDesign;
    if (Date.now() - out.ts > 23 * 60 * 60 * 1000) return null;
    return out;
  } catch {
    return null;
  }
}

function saveCached(d: CachedDesign): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(d));
  } catch {
    // ignore quota errors
  }
}

function clearCached(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

function b64ToBlobUrl(b64: string, mime = "audio/mpeg"): string {
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    return `data:${mime};base64,${b64}`;
  }
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mime });
  return URL.createObjectURL(blob);
}

export function StudioVoiceNew() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("method");
  const [method, setMethod] = useState<Method>("design");

  // Design state
  const [prompt, setPrompt] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loudness, setLoudness] = useState(0.75);
  const [guidanceScale, setGuidanceScale] = useState(38);
  const [previews, setPreviews] = useState<DesignPreviewItem[]>([]);
  const [selectedPreviewId, setSelectedPreviewId] = useState<string | null>(
    null,
  );

  // IVC state
  const [ivcFiles, setIvcFiles] = useState<File[]>([]);
  // PVC state
  const [pvcFiles, setPvcFiles] = useState<File[]>([]);
  const [pvcLanguage, setPvcLanguage] = useState("en");
  const [pvcJob, setPvcJob] = useState<VoiceCloneJob | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore from session — survives page reload while generated_voice_id
  // claims are still valid (24h on ElevenLabs).
  useEffect(() => {
    const cached = loadCached();
    if (cached && cached.previews.length > 0) {
      setPrompt(cached.prompt);
      setName(cached.name);
      setDescription(cached.description);
      setPreviews(cached.previews);
      setSelectedPreviewId(cached.selectedId);
      setStep("previews");
    }
  }, []);

  async function runDesign() {
    setError(null);
    if (!prompt.trim() || !name.trim()) {
      setError("Prompt and name required.");
      return;
    }
    setBusy(true);
    try {
      const out = await api.designPreviews({
        prompt: prompt.trim(),
        name: name.trim(),
        loudness,
        guidance_scale: guidanceScale,
      });
      setPreviews(out.previews);
      setSelectedPreviewId(out.previews[0]?.generated_voice_id ?? null);
      saveCached({
        prompt: prompt.trim(),
        name: name.trim(),
        description: description.trim(),
        previews: out.previews,
        selectedId: out.previews[0]?.generated_voice_id ?? null,
        ts: Date.now(),
      });
      setStep("previews");
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 402) setError("Out of credits. Top up to design a voice.");
        else setError(`Design failed: ${e.message || e.status}`);
      } else {
        setError("Design failed.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function runIvc(publish_kind: PublishKind) {
    if (ivcFiles.length === 0) {
      setError("Add at least one audio sample.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("name", name.trim() || "Cloned voice");
      form.append("description", description.trim());
      form.append("publish_kind", publish_kind);
      for (const f of ivcFiles) {
        form.append("files", f, f.name);
      }
      const out = await api.cloneInstant(form);
      if (publish_kind === "marketplace_draft") {
        navigate(`/v/${encodeURIComponent(out.id)}`);
      } else {
        navigate("/creator");
      }
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 402) {
          setError("Out of credits. Top up to clone a voice.");
        } else if (e.status === 413) {
          setError("Audio file too large.");
        } else {
          setError(`Clone failed: ${e.message || e.status}`);
        }
      } else {
        setError("Clone failed.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function runPvc(publish_kind: PublishKind) {
    if (pvcFiles.length === 0) {
      setError("Add at least one audio sample (3–10 recommended).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("name", name.trim() || "Professional clone");
      form.append("description", description.trim());
      form.append("language", pvcLanguage);
      form.append("publish_kind", publish_kind);
      for (const f of pvcFiles) {
        form.append("files", f, f.name);
      }
      const job = await api.clonePvc(form);
      setPvcJob(job);
      setStep("job");
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 402) setError("Out of credits.");
        else if (e.status === 413) setError("Audio too large.");
        else setError(`PVC failed: ${e.message || e.status}`);
      } else {
        setError("PVC failed.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function runSave(publish_kind: PublishKind) {
    if (!selectedPreviewId) return;
    const chosen = previews.find(
      (p) => p.generated_voice_id === selectedPreviewId,
    );
    if (!chosen) return;
    setBusy(true);
    setError(null);
    // ElevenLabs voice_description must be a substantial string — fall back
    // to the prompt (or a padded marketing line) when the buyer-facing
    // description is empty / too short.
    const rawDesc = description.trim();
    const finalDesc =
      rawDesc.length >= 20
        ? rawDesc
        : prompt.trim().length >= 20
          ? prompt.trim()
          : `${name.trim() || "Custom voice"}. ${prompt.trim() || rawDesc || "A character voice designed in Multiverse Studio."}`;
    try {
      const out: CreatedVoice = await api.designSave({
        generated_voice_id: chosen.generated_voice_id,
        name: name.trim(),
        description: finalDesc,
        audio_base_64: chosen.audio_base_64,
        publish_kind,
      });
      clearCached();
      if (publish_kind === "marketplace_draft") {
        navigate(`/v/${encodeURIComponent(out.id)}`);
      } else {
        navigate("/creator");
      }
    } catch (e) {
      const msg = e instanceof ApiError ? (e.message || String(e.status)) : (e instanceof Error ? e.message : "unknown");
      // 502 with "preview" / "generated_voice_id" in the message means the
      // single-use preview was already claimed or expired upstream.
      const looksExpired =
        e instanceof ApiError &&
        e.status === 502 &&
        /preview|generated_voice_id|404/i.test(msg);
      if (looksExpired) {
        setError("Preview expired — regenerate previews and try again.");
        clearCached();
        setPreviews([]);
        setSelectedPreviewId(null);
        setStep("capture");
      } else {
        setError(`Save failed: ${msg}`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6" data-testid="voice-new">
      <header className="space-y-2">
        <Link
          to="/studio"
          className="text-[10px] font-mono uppercase tracking-[0.22em] text-silver hover:text-warm"
        >
          ← Studio
        </Link>
        <h1 className="text-2xl text-warm font-display">Create a voice</h1>
        <p className="text-[12px] text-silver">
          Design, clone, or train a voice. Use it privately in voice packs or
          publish as a sellable marketplace asset.
        </p>
      </header>

      {step === "method" && (
        <MethodPicker
          method={method}
          onSelect={(m) => {
            setMethod(m);
            setStep("capture");
          }}
        />
      )}

      {step === "capture" && method === "design" && (
        <DesignCaptureForm
          prompt={prompt}
          setPrompt={setPrompt}
          name={name}
          setName={setName}
          description={description}
          setDescription={setDescription}
          loudness={loudness}
          setLoudness={setLoudness}
          guidanceScale={guidanceScale}
          setGuidanceScale={setGuidanceScale}
          busy={busy}
          onSubmit={runDesign}
          onBack={() => setStep("method")}
        />
      )}

      {step === "capture" && method === "ivc" && (
        <IvcCaptureForm
          name={name}
          setName={setName}
          description={description}
          setDescription={setDescription}
          files={ivcFiles}
          onFiles={(f) => setIvcFiles(f)}
          onContinue={() => setStep("fork")}
          onBack={() => setStep("method")}
        />
      )}

      {step === "capture" && method === "pvc" && (
        <PvcCaptureForm
          name={name}
          setName={setName}
          description={description}
          setDescription={setDescription}
          language={pvcLanguage}
          setLanguage={setPvcLanguage}
          files={pvcFiles}
          onFiles={setPvcFiles}
          onContinue={() => setStep("fork")}
          onBack={() => setStep("method")}
        />
      )}

      {step === "previews" && (
        <PreviewPicker
          previews={previews}
          selectedId={selectedPreviewId}
          onSelect={(id) => {
            setSelectedPreviewId(id);
            const cached = loadCached();
            if (cached) saveCached({ ...cached, selectedId: id });
          }}
          onBack={() => setStep("capture")}
          onConfirm={() => setStep("fork")}
        />
      )}

      {step === "fork" && (
        <PublishForkPanel
          busy={busy}
          onPick={
            method === "ivc"
              ? runIvc
              : method === "pvc"
              ? runPvc
              : runSave
          }
          onBack={() =>
            setStep(method === "design" ? "previews" : "capture")
          }
        />
      )}

      {step === "job" && pvcJob && (
        <div className="space-y-3">
          <div className="p-4 rounded-lg border border-dashed border-glass-soft bg-elev-2/30 text-silver text-[13px]">
            Professional Voice Cloning is coming soon. Try Voice Design or
            Instant Voice Clone for now.
          </div>
          <Link
            to="/creator"
            className="text-[10px] font-mono uppercase tracking-[0.22em] text-silver hover:text-warm"
          >
            ← Back to dashboard
          </Link>
        </div>
      )}

      {error && (
        <div
          role="alert"
          data-testid="voice-new-error"
          className="text-[12px] text-rose-300 border border-rose-400/30 rounded-md p-3 bg-rose-500/10"
        >
          {error}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function MethodPicker({
  method,
  onSelect,
}: {
  method: Method;
  onSelect: (m: Method) => void;
}) {
  const opts: Array<{
    id: Method;
    title: string;
    cost: string;
    copy: string;
    comingSoon?: boolean;
  }> = [
    {
      id: "design",
      title: "Voice Design",
      cost: "5 credits",
      copy: "Describe a voice in text. Get 3 AI-generated previews. Pick one.",
    },
    {
      id: "ivc",
      title: "Instant Voice Clone",
      cost: "10 credits",
      copy: "Record 30–60 s of clean audio. Get a clone of your own voice in seconds.",
    },
    {
      id: "pvc",
      title: "Professional Voice Clone",
      cost: "Coming soon",
      copy: "Upload several minutes of audio. High-fidelity clone trained over 24–72 h.",
      comingSoon: true,
    },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3" data-testid="method-picker">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          data-testid={`method-${o.id}`}
          onClick={() => {
            if (o.comingSoon) return;
            onSelect(o.id);
          }}
          disabled={o.comingSoon}
          aria-disabled={o.comingSoon}
          className={cn(
            "relative text-left p-4 rounded-lg border space-y-2",
            o.comingSoon
              ? "border-glass-soft/60 bg-elev-2/30 opacity-60 cursor-not-allowed"
              : method === o.id
                ? "border-molten/60 bg-molten-tint"
                : "border-glass-soft hover:border-warm/40",
          )}
        >
          {o.comingSoon && (
            <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-pill bg-molten-tint border border-molten/40 font-mono text-molten text-[8.5px] tracking-[0.22em] uppercase">
              Coming soon
            </span>
          )}
          <div className="text-warm font-display text-lg">{o.title}</div>
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-molten">
            {o.cost}
          </div>
          <p className="text-[12px] text-silver">{o.copy}</p>
        </button>
      ))}
    </div>
  );
}

function DesignCaptureForm(props: {
  prompt: string;
  setPrompt: (v: string) => void;
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  loudness: number;
  setLoudness: (v: number) => void;
  guidanceScale: number;
  setGuidanceScale: (v: number) => void;
  busy: boolean;
  onSubmit: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-3" data-testid="design-form">
      <input
        type="text"
        placeholder="Voice name (e.g. Night Cab Sylvia)"
        value={props.name}
        onChange={(e) => props.setName(e.target.value)}
        data-testid="design-name"
        className="w-full p-2 rounded-md bg-elev-2/60 border border-glass-soft text-warm"
      />
      <div className="relative">
        <textarea
          placeholder="Describe the voice (timbre, mood, style…). Avoid real names or copyrighted characters — describe their vocal traits instead."
          value={props.prompt}
          onChange={(e) => props.setPrompt(e.target.value)}
          data-testid="design-prompt"
          className="w-full min-h-28 p-2 pr-12 rounded-md bg-elev-2/60 border border-glass-soft text-warm"
        />
        <div className="absolute right-2 top-2">
          <PromptEnhanceButton
            value={props.prompt}
            kind="voice_design"
            onAccept={(next) => props.setPrompt(next)}
          />
        </div>
      </div>
      <textarea
        placeholder="Optional description shown to buyers"
        value={props.description}
        onChange={(e) => props.setDescription(e.target.value)}
        data-testid="design-description"
        className="w-full min-h-16 p-2 rounded-md bg-elev-2/60 border border-glass-soft text-warm"
      />
      <div className="space-y-3 rounded-md border border-glass-soft bg-elev-2/40 p-3">
        <div>
          <div className="flex justify-between text-[10px] font-mono uppercase tracking-[0.18em] text-silver">
            <span>Loudness</span>
            <span data-testid="design-loudness-value">
              {props.loudness.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min={-1}
            max={1}
            step={0.05}
            value={props.loudness}
            onChange={(e) =>
              props.setLoudness(Number.parseFloat(e.target.value))
            }
            data-testid="design-loudness"
            className="w-full accent-molten"
          />
        </div>
        <div>
          <div className="flex justify-between text-[10px] font-mono uppercase tracking-[0.18em] text-silver">
            <span>Guidance scale</span>
            <span data-testid="design-guidance-value">
              {props.guidanceScale.toFixed(1)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={0.5}
            value={props.guidanceScale}
            onChange={(e) =>
              props.setGuidanceScale(Number.parseFloat(e.target.value))
            }
            data-testid="design-guidance"
            className="w-full accent-molten"
          />
        </div>
      </div>
      <div className="flex justify-between items-center pt-2">
        <button
          type="button"
          onClick={props.onBack}
          className="text-[10px] font-mono uppercase tracking-[0.22em] text-silver hover:text-warm"
        >
          ← Back
        </button>
        <button
          type="button"
          data-testid="design-submit"
          disabled={props.busy || !props.prompt.trim() || !props.name.trim()}
          onClick={props.onSubmit}
          className="px-4 py-2 rounded-md bg-molten text-[11px] tracking-[0.18em] uppercase font-mono font-semibold disabled:opacity-40"
          style={{ color: "#1a0700" }}
        >
          {props.busy ? "Designing…" : "Generate 3 previews · 5 cr"}
        </button>
      </div>
    </div>
  );
}

function PreviewPicker(props: {
  previews: DesignPreviewItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="space-y-3" data-testid="preview-picker">
      <div className="text-[12px] text-silver italic">
        Previews expire 24 h after generation. Save your favourite now.
      </div>
      {props.previews.map((p, i) => (
        <PreviewCard
          key={p.generated_voice_id}
          index={i}
          preview={p}
          selected={p.generated_voice_id === props.selectedId}
          onSelect={() => props.onSelect(p.generated_voice_id)}
        />
      ))}
      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={props.onBack}
          className="text-[10px] font-mono uppercase tracking-[0.22em] text-silver hover:text-warm"
        >
          ← Regenerate
        </button>
        <button
          type="button"
          data-testid="preview-confirm"
          disabled={!props.selectedId}
          onClick={props.onConfirm}
          className="px-4 py-2 rounded-md bg-molten text-[11px] tracking-[0.18em] uppercase font-mono font-semibold disabled:opacity-40"
          style={{ color: "#1a0700" }}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}

function PreviewCard({
  index,
  preview,
  selected,
  onSelect,
}: {
  index: number;
  preview: DesignPreviewItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const url = useMemo(
    () => b64ToBlobUrl(preview.audio_base_64, preview.media_type),
    [preview.audio_base_64, preview.media_type],
  );
  useEffect(
    () => () => {
      if (url.startsWith("blob:") && typeof URL.revokeObjectURL === "function") {
        URL.revokeObjectURL(url);
      }
    },
    [url],
  );
  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`preview-${index}`}
      className={cn(
        "w-full p-3 rounded-md border text-left space-y-2",
        selected
          ? "border-molten/60 bg-molten-tint"
          : "border-glass-soft hover:border-warm/40",
      )}
    >
      <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-silver">
        Preview {index + 1}
      </div>
      <audio src={url} controls className="w-full h-8" />
    </button>
  );
}

function PublishForkPanel(props: {
  busy: boolean;
  onPick: (k: PublishKind) => void;
  onBack: () => void;
}) {
  const [pickedKind, setPickedKind] = useState<PublishKind | null>(null);

  function handlePick(k: PublishKind) {
    setPickedKind(k);
    props.onPick(k);
  }

  if (props.busy) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-6 p-10 rounded-lg border border-glass-soft bg-elev-2/30"
        data-testid="fork-panel-busy"
        role="status"
        aria-live="polite"
      >
        <div className="relative size-16" aria-hidden>
          <span className="absolute inset-0 rounded-full border-2 border-molten/30" />
          <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-molten animate-spin" />
          <span className="absolute inset-3 rounded-full bg-molten/20 animate-pulse" />
        </div>
        <h2 className="text-warm font-display text-xl">
          {pickedKind === "marketplace_draft"
            ? "Publishing to marketplace…"
            : "Saving voice…"}
        </h2>
        <p className="text-[12px] text-silver font-mono">
          Hang tight — don't close this tab.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="fork-panel">
      <h2 className="text-warm font-display text-xl">
        How do you want to use this voice?
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          data-testid="fork-private"
          disabled={props.busy}
          onClick={() => handlePick("private")}
          className="text-left p-4 rounded-lg border border-glass-soft hover:border-warm/40 space-y-2"
        >
          <div className="text-warm font-display text-lg">Use privately</div>
          <p className="text-[12px] text-silver">
            Available in your voice packs and TTS. Stays hidden from the
            marketplace.
          </p>
        </button>
        <button
          type="button"
          data-testid="fork-marketplace"
          disabled={props.busy}
          onClick={() => handlePick("marketplace_draft")}
          className="text-left p-4 rounded-lg border border-glass-soft hover:border-warm/40 space-y-2"
        >
          <div className="text-warm font-display text-lg">
            Publish as marketplace asset
          </div>
          <p className="text-[12px] text-silver">
            Creates a published Voice on /voices priced at 25 ⚡ by default.
          </p>
        </button>
      </div>
      <div className="pt-2">
        <button
          type="button"
          onClick={props.onBack}
          className="text-[10px] font-mono uppercase tracking-[0.22em] text-silver hover:text-warm"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}

function IvcCaptureForm(props: {
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  files: File[];
  onFiles: (files: File[], mime?: string) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<"record" | "upload">("record");

  return (
    <div className="space-y-4" data-testid="ivc-form">
      <input
        type="text"
        placeholder="Voice name"
        value={props.name}
        onChange={(e) => props.setName(e.target.value)}
        data-testid="ivc-name"
        className="w-full p-2 rounded-md bg-elev-2/60 border border-glass-soft text-warm"
      />
      <textarea
        placeholder="Optional description"
        value={props.description}
        onChange={(e) => props.setDescription(e.target.value)}
        data-testid="ivc-description"
        className="w-full min-h-16 p-2 rounded-md bg-elev-2/60 border border-glass-soft text-warm"
      />

      <div className="flex gap-2 text-[10px] font-mono tracking-[0.22em] uppercase">
        {(["record", "upload"] as const).map((m) => (
          <button
            key={m}
            type="button"
            data-testid={`ivc-mode-${m}`}
            onClick={() => setMode(m)}
            className={cn(
              "px-2 py-1 rounded-md border",
              mode === m
                ? "text-molten border-molten/50 bg-molten-tint"
                : "text-silver border-glass-soft hover:text-warm",
            )}
          >
            {m}
          </button>
        ))}
      </div>

      {mode === "record" && (
        <MicRecorder
          maxSeconds={60}
          onComplete={(blob, mime) => {
            const f = new File([blob], `recording.${mime.includes("webm") ? "webm" : "mp4"}`, {
              type: mime,
            });
            props.onFiles([f], mime);
          }}
        />
      )}
      {mode === "upload" && (
        <AudioDropZone onChange={(files) => props.onFiles(files)} />
      )}

      {props.files.length > 0 && (
        <div className="text-[12px] text-silver" data-testid="ivc-file-status">
          {props.files.length} sample ready ({Math.round(props.files[0].size / 1024)} KB)
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={props.onBack}
          className="text-[10px] font-mono uppercase tracking-[0.22em] text-silver hover:text-warm"
        >
          ← Back
        </button>
        <button
          type="button"
          data-testid="ivc-continue"
          disabled={props.files.length === 0 || !props.name.trim()}
          onClick={props.onContinue}
          className="px-4 py-2 rounded-md bg-molten text-[11px] tracking-[0.18em] uppercase font-mono font-semibold disabled:opacity-40"
          style={{ color: "#1a0700" }}
        >
          Continue → 10 cr
        </button>
      </div>
    </div>
  );
}

function PvcCaptureForm(props: {
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  language: string;
  setLanguage: (v: string) => void;
  files: File[];
  onFiles: (files: File[]) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4" data-testid="pvc-form">
      <input
        type="text"
        placeholder="Voice name"
        value={props.name}
        onChange={(e) => props.setName(e.target.value)}
        data-testid="pvc-name"
        className="w-full p-2 rounded-md bg-elev-2/60 border border-glass-soft text-warm"
      />
      <textarea
        placeholder="Optional description"
        value={props.description}
        onChange={(e) => props.setDescription(e.target.value)}
        data-testid="pvc-description"
        className="w-full min-h-16 p-2 rounded-md bg-elev-2/60 border border-glass-soft text-warm"
      />
      <input
        type="text"
        placeholder="Language code (e.g. en)"
        value={props.language}
        onChange={(e) => props.setLanguage(e.target.value)}
        data-testid="pvc-language"
        className="w-full p-2 rounded-md bg-elev-2/60 border border-glass-soft text-warm"
      />
      <AudioDropZone
        multiple
        maxBytes={50 * 1024 * 1024}
        totalMaxBytes={250 * 1024 * 1024}
        onChange={props.onFiles}
      />
      <div className="text-[12px] text-silver">
        Upload 3–10 clean audio samples (1–5 minutes each, multiple
        accents/emotions help). Training takes 24–72 h. 50 credits charged
        up front — refunded automatically if training fails.
      </div>
      {props.files.length > 0 && (
        <div className="text-[12px] text-silver" data-testid="pvc-file-status">
          {props.files.length} samples ready
        </div>
      )}
      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={props.onBack}
          className="text-[10px] font-mono uppercase tracking-[0.22em] text-silver hover:text-warm"
        >
          ← Back
        </button>
        <button
          type="button"
          data-testid="pvc-continue"
          disabled={props.files.length === 0 || !props.name.trim()}
          onClick={props.onContinue}
          className="px-4 py-2 rounded-md bg-molten text-[11px] tracking-[0.18em] uppercase font-mono font-semibold disabled:opacity-40"
          style={{ color: "#1a0700" }}
        >
          Continue → 50 cr
        </button>
      </div>
    </div>
  );
}
