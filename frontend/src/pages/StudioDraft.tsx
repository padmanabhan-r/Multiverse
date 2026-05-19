import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Pack, PackSample, SampleKind } from "@multiverse/shared";
import { api } from "@/lib/api";
import { CoverArtPicker } from "@/components/CoverArtPicker";
import { SampleGenerator } from "@/components/SampleGenerator";
import { SampleList } from "@/components/SampleList";

function inferSampleKind(pack: Pack): SampleKind {
  const stored = pack.style_profile?.sample_kind;
  if (
    stored === "sfx" ||
    stored === "music" ||
    stored === "voice" ||
    stored === "ambient"
  ) {
    return stored;
  }
  if (pack.category === "music") return "music";
  if (pack.category === "voice_packs") return "voice";
  if (pack.category === "ambient") return "ambient";
  return "sfx";
}

const SAVE_DEBOUNCE_MS = 700;

export function StudioDraft() {
  const { packId } = useParams<{ packId: string }>();
  const nav = useNavigate();
  const [pack, setPack] = useState<Pack | null>(null);
  const [samples, setSamples] = useState<PackSample[]>([]);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [heroUrl, setHeroUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Editable metadata.
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!packId) return;
    try {
      const [p, ss] = await Promise.all([
        api.getPack(packId),
        api.listSamples(packId),
      ]);
      setPack(p);
      setSamples(ss);
      setCoverUrl(p.cover_art_url);
      setHeroUrl(p.hero_art_url);
      setTitle(p.title);
      setDescription(p.description ?? "");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "load failed");
    }
  }, [packId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Debounced auto-save when title/description change after first load.
  useEffect(() => {
    if (!pack) return;
    if (title === pack.title && description === (pack.description ?? "")) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      setSaving("saving");
      try {
        const updated = await api.updatePack(pack.id, {
          title: title.trim() || pack.title,
          description: description.trim(),
        });
        setPack(updated);
        setSaving("saved");
        window.setTimeout(() => setSaving("idle"), 1200);
        // Slug regenerated server-side for drafts → keep URL in sync.
        if (updated.id !== pack.id) {
          nav(`/studio/draft/${updated.id}`, { replace: true });
        }
      } catch {
        setSaving("idle");
      }
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [title, description, pack]);

  if (err)
    return (
      <div data-testid="studio-draft-error" className="text-molten">
        {err}
      </div>
    );
  if (!pack)
    return (
      <div data-testid="studio-draft-loading" className="text-silver">
        Loading…
      </div>
    );

  const kind = inferSampleKind(pack);
  const lockedVoiceId =
    kind === "voice" && samples.length > 0 ? samples[0].voice_id : null;
  const readyToPublish = samples.length > 0 && title.trim().length > 0;

  return (
    <section className="space-y-6 pb-8" data-testid="studio-draft">
      {/* Header: editable metadata + status */}
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-mono text-silver2 text-[10px] tracking-[0.32em] uppercase">
            Studio · New {kind} pack · Draft
          </div>
          <SaveBadge state={saving} />
        </div>
        <div className="space-y-2">
          <input
            type="text"
            data-testid="draft-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled pack"
            maxLength={120}
            className="
              w-full bg-transparent border-0 border-b border-glass-soft
              focus:border-molten focus:outline-none
              font-display text-warm text-2xl sm:text-4xl tracking-tight
              placeholder:text-silver2/50 py-1
            "
          />
          <textarea
            data-testid="draft-description-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="One line about this pack — what's in it, where to use it."
            maxLength={300}
            rows={2}
            className="
              w-full bg-transparent border border-glass-soft rounded-md
              focus:border-molten focus:outline-none
              text-silver text-[13px] leading-snug
              placeholder:text-silver2/50 px-3 py-2 resize-none
            "
          />
        </div>
      </header>

      {/* Step rail */}
      <div className="grid grid-cols-3 gap-2" data-testid="step-rail">
        <Step
          n={1}
          label="Name your pack"
          done={title.trim().length > 0}
        />
        <Step
          n={2}
          label="Generate samples"
          done={samples.length > 0}
          countLabel={`${samples.length} ${samples.length === 1 ? "sample" : "samples"}`}
        />
        <Step n={3} label="Cover + publish" done={!!coverUrl} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,300px] gap-6">
        <div className="space-y-6">
          <section
            className="mvfm-glass rounded-xl p-4 sm:p-6 space-y-3"
            data-testid="step-generate"
          >
            <div className="flex items-baseline justify-between">
              <h2 className="font-mono text-warm text-[12px] tracking-[0.22em] uppercase font-semibold">
                Generate {kind === "music" ? "track" : kind === "voice" ? "line" : kind === "ambient" ? "bed" : "sample"}
              </h2>
              <span className="font-mono text-silver2 text-[10px] tracking-[0.18em] uppercase">
                {samples.length.toString().padStart(2, "0")} in pack
              </span>
            </div>
            <SampleGenerator
              packId={pack.id}
              kind={kind}
              lockedVoiceId={lockedVoiceId}
              onLockVoice={() => undefined}
              onGenerated={refresh}
            />
          </section>

          {samples.length > 0 && (
            <section
              className="mvfm-glass rounded-xl p-4 sm:p-6 space-y-3"
              data-testid="step-samples"
            >
              <h2 className="font-mono text-warm text-[12px] tracking-[0.22em] uppercase font-semibold">
                Samples
              </h2>
              <SampleList
                packId={pack.id}
                samples={samples}
                onChange={refresh}
              />
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section className="mvfm-glass rounded-xl p-4 space-y-3">
            <h2 className="font-mono text-warm text-[12px] tracking-[0.22em] uppercase font-semibold">
              Cover art
            </h2>
            <CoverArtPicker
              packId={pack.id}
              currentUrl={coverUrl}
              currentHeroUrl={heroUrl}
              onChange={setCoverUrl}
              onHeroChange={setHeroUrl}
            />
          </section>

          <button
            type="button"
            data-testid="continue-publish"
            disabled={!readyToPublish}
            onClick={() => nav(`/studio/publish?packId=${pack.id}`)}
            className="
              w-full px-4 py-2.5 rounded-md bg-molten text-[11px]
              tracking-[0.22em] uppercase font-mono font-semibold whitespace-nowrap
              disabled:opacity-40 disabled:cursor-not-allowed
              shadow-bloom hover:bg-molten-glow
            "
            style={{ color: "#1a0700" }}
          >
            Continue to publish →
          </button>
          {!readyToPublish && (
            <div className="text-[11px] text-silver2 italic px-1">
              {samples.length === 0
                ? "Generate at least one sample first."
                : "Give your pack a name first."}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function Step({
  n,
  label,
  done,
  countLabel,
}: {
  n: number;
  label: string;
  done: boolean;
  countLabel?: string;
}) {
  return (
    <div
      data-testid={`step-${n}`}
      data-done={done}
      className={
        done
          ? "rounded-md border border-molten/40 bg-molten-tint/40 px-3 py-2"
          : "rounded-md border border-glass-soft bg-elev-2/40 px-3 py-2"
      }
    >
      <div className="flex items-center gap-2">
        <span
          className={
            done
              ? "size-4 rounded-full bg-molten flex items-center justify-center font-mono text-[8px] font-semibold"
              : "size-4 rounded-full border border-glass-soft flex items-center justify-center font-mono text-[8.5px] text-silver2"
          }
          style={done ? { color: "#1a0700" } : undefined}
        >
          {done ? "✓" : n}
        </span>
        <span
          className={
            done
              ? "font-mono text-warm text-[10px] tracking-[0.18em] uppercase"
              : "font-mono text-silver text-[10px] tracking-[0.18em] uppercase"
          }
        >
          {label}
        </span>
      </div>
      {countLabel && (
        <div className="mt-1 font-mono text-silver2 text-[9.5px] tracking-[0.14em] ml-6">
          {countLabel}
        </div>
      )}
    </div>
  );
}

function SaveBadge({ state }: { state: "idle" | "saving" | "saved" }) {
  if (state === "idle") return null;
  return (
    <span
      data-testid="save-badge"
      className="font-mono text-[9.5px] tracking-[0.22em] uppercase text-silver2"
    >
      {state === "saving" ? "Saving…" : "Saved"}
    </span>
  );
}
