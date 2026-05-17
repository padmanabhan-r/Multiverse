import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Pack, PackSample, SampleKind } from "@multiverse-fm/shared";
import { api } from "@/lib/api";
import { CoverArtPicker } from "@/components/CoverArtPicker";
import { SampleGenerator } from "@/components/SampleGenerator";
import { SampleList } from "@/components/SampleList";

function inferSampleKind(pack: Pack): SampleKind {
  const stored = pack.style_profile?.sample_kind;
  if (stored === "sfx" || stored === "music" || stored === "voice" || stored === "ambient") {
    return stored;
  }
  // Fallback by category
  if (pack.category === "music") return "music";
  if (pack.category === "voice_packs") return "voice";
  if (pack.category === "ambient") return "ambient";
  return "sfx";
}

export function StudioDraft() {
  const { packId } = useParams<{ packId: string }>();
  const nav = useNavigate();
  const [pack, setPack] = useState<Pack | null>(null);
  const [samples, setSamples] = useState<PackSample[]>([]);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
    } catch (e) {
      setErr(e instanceof Error ? e.message : "load failed");
    }
  }, [packId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (err) return <div className="text-molten">{err}</div>;
  if (!pack) {
    return (
      <div data-testid="studio-draft-loading" className="text-silver">
        Loading…
      </div>
    );
  }

  const kind = inferSampleKind(pack);
  const lockedVoiceId =
    kind === "voice" && samples.length > 0 ? samples[0].voice_id : null;

  return (
    <section className="space-y-6 pb-8" data-testid="studio-draft">
      <header className="flex flex-wrap items-baseline gap-3">
        <div className="font-mono text-silver2 text-[10px] tracking-[0.32em] uppercase">
          Studio · {kind} pack
        </div>
        <h1 className="font-display text-warm text-2xl sm:text-3xl tracking-tight">
          {pack.title}
        </h1>
        <span className="font-mono text-[10px] text-silver">
          {samples.length} sample{samples.length === 1 ? "" : "s"}
        </span>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,260px] gap-6">
        <div className="space-y-6">
          <section className="mvfm-glass rounded-xl p-4 sm:p-6">
            <h2 className="font-display text-warm text-lg mb-3">Generate sample</h2>
            <SampleGenerator
              packId={pack.id}
              kind={kind}
              lockedVoiceId={lockedVoiceId}
              onLockVoice={() => undefined}
              onGenerated={refresh}
            />
          </section>

          <section className="mvfm-glass rounded-xl p-4 sm:p-6">
            <h2 className="font-display text-warm text-lg mb-3">Samples</h2>
            <SampleList
              packId={pack.id}
              samples={samples}
              onChange={refresh}
            />
          </section>
        </div>

        <aside className="space-y-4">
          <section className="mvfm-glass rounded-xl p-4">
            <h2 className="font-display text-warm text-base mb-3">Cover art</h2>
            <CoverArtPicker
              packId={pack.id}
              currentUrl={coverUrl}
              onChange={setCoverUrl}
            />
          </section>
          <button
            type="button"
            data-testid="continue-publish"
            disabled={samples.length === 0}
            onClick={() => nav(`/studio/publish?packId=${pack.id}`)}
            className="
              w-full px-4 py-2.5 rounded-md bg-molten text-[11px]
              tracking-[0.22em] uppercase font-mono font-semibold
              disabled:opacity-40 shadow-bloom hover:bg-molten-glow
            "
            style={{ color: "#1a0700" }}
          >
            Continue to publish
          </button>
          {samples.length === 0 && (
            <div className="text-[11px] text-silver2 italic">
              Add at least one sample before publishing.
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
