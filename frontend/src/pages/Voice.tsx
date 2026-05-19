import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, api, type MarketplaceVoice } from "@/lib/api";
import { plateFor } from "@/lib/stationArt";

export function Voice() {
  const { voiceId } = useParams<{ voiceId: string }>();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [voice, setVoice] = useState<MarketplaceVoice | null>(null);
  const [owned, setOwned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!voiceId) return;
    Promise.all([
      api.getMarketplaceVoice(voiceId),
      api.listOwnedVoices().catch(() => []),
    ])
      .then(([v, mine]) => {
        setVoice(v);
        setOwned(mine.some((m) => m.id === v.id));
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "load failed"));
  }, [voiceId]);

  function togglePreview() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  }

  async function buy() {
    if (!voice) return;
    setBusy(true);
    setErr(null);
    try {
      await api.purchaseVoice(voice.id);
      qc.invalidateQueries({ queryKey: ["me", "credits"] });
      setOwned(true);
      setTimeout(() => nav("/library"), 800);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 402) {
          setErr("Not enough credits — top up first.");
          setTimeout(() => nav("/credits"), 1200);
        } else if (e.status === 409) {
          setOwned(true);
          setErr("Already owned.");
        } else {
          setErr(e.message || "purchase failed");
        }
      } else {
        setErr(e instanceof Error ? e.message : "purchase failed");
      }
      setBusy(false);
    }
  }

  if (err && !voice)
    return (
      <div data-testid="voice-error" className="text-molten">
        {err}
      </div>
    );
  if (!voice)
    return (
      <div data-testid="voice-loading" className="text-silver">
        Loading…
      </div>
    );

  const plate = plateFor(voice.id);

  return (
    <section className="space-y-6 pb-8" data-testid="voice-detail">
      <header className="grid grid-cols-1 lg:grid-cols-[1fr,300px] gap-6">
        <div
          className="aspect-[16/9] rounded-xl overflow-hidden border border-glass-soft relative"
          style={{
            background: voice.cover_art_url
              ? `center / cover no-repeat url('${voice.cover_art_url}'), ${plate.background}`
              : plate.background,
          }}
        >
          <span aria-hidden className="absolute inset-0 mvfm-grain opacity-40" />
          {voice.preview_url && (
            <>
              <button
                type="button"
                data-testid="voice-preview-toggle"
                onClick={togglePreview}
                aria-label={playing ? "Pause preview" : "Play preview"}
                className="
                  absolute top-4 right-4 size-14 rounded-full
                  bg-molten hover:bg-molten-glow shadow-bloom
                  flex items-center justify-center
                  transition-transform duration-fast ease-tune
                  hover:scale-105
                "
                style={{ color: "#1a0700" }}
              >
                {playing ? (
                  <svg viewBox="0 0 14 14" fill="currentColor" className="size-5">
                    <rect x="3" y="2" width="3" height="10" rx="0.5" />
                    <rect x="8" y="2" width="3" height="10" rx="0.5" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 14 14" fill="currentColor" className="size-5">
                    <path d="M4 2.5L11 7L4 11.5V2.5Z" />
                  </svg>
                )}
              </button>
              <audio
                ref={audioRef}
                src={voice.preview_url}
                preload="none"
                onEnded={() => setPlaying(false)}
                onPause={() => setPlaying(false)}
              />
            </>
          )}
          <div className="absolute bottom-4 left-4 right-4">
            <div className="font-mono text-silver2 text-[10px] tracking-[0.32em] uppercase mb-1">
              Voice · by {voice.creator_name}
            </div>
            <h1 className="mvfm-display text-warm text-[36px] sm:text-[52px] leading-[0.95]">
              {voice.title}
            </h1>
          </div>
        </div>

        <aside className="space-y-4 p-5 rounded-xl bg-elev-2/40 border border-glass-soft">
          <div>
            <div className="font-mono text-silver2 text-[10px] tracking-[0.28em] uppercase mb-1">
              Price
            </div>
            <div className="mvfm-display text-warm text-[40px] leading-none">
              {voice.price_credits} <span className="text-molten">⚡</span>
            </div>
            <div className="text-silver2 text-[11px] mt-1">
              Lifetime access
            </div>
          </div>

          {owned ? (
            <div className="space-y-2">
              <Link
                to={`/studio/tts?voiceId=${voice.id}`}
                data-testid="voice-use-cta"
                style={{ color: "#1a0700" }}
                className="
                  block w-full text-center px-3 py-2.5 rounded-md whitespace-nowrap
                  bg-molten hover:bg-molten-glow shadow-bloom
                  font-mono text-[10.5px] tracking-[0.18em] uppercase font-semibold
                "
              >
                Use in Studio →
              </Link>
              <Link
                to="/library"
                data-testid="voice-owned-cta"
                className="
                  block w-full text-center px-3 py-2 rounded-md whitespace-nowrap
                  bg-elev-2/60 border border-molten/40 text-molten
                  font-mono text-[10px] tracking-[0.18em] uppercase
                "
              >
                Owned · open Library →
              </Link>
            </div>
          ) : (
            <button
              type="button"
              data-testid={`buy-voice-${voice.id}`}
              onClick={buy}
              disabled={busy}
              style={{ color: "#1a0700" }}
              className="
                w-full px-4 py-2.5 rounded-md bg-molten font-mono text-[11px]
                tracking-[0.22em] uppercase font-semibold hover:bg-molten-glow
                shadow-bloom disabled:opacity-50
              "
            >
              {busy ? "Buying…" : `Buy for ${voice.price_credits} ⚡`}
            </button>
          )}
          {err && <div className="text-molten text-[11px]">{err}</div>}

          <p className="text-silver2 text-[11px] leading-snug">
            Pay once. Use forever. Each TTS generation also consumes 1 credit
            per ≤5 min of audio output. Royalty-free.
          </p>
        </aside>
      </header>

      <section className="space-y-2">
        <div className="font-mono text-silver2 text-[10px] tracking-[0.28em] uppercase">
          About this voice
        </div>
        <p className="text-warm text-[14px] leading-relaxed max-w-prose">
          {voice.description || "No description."}
        </p>
        {voice.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {voice.tags.map((t) => (
              <span
                key={t}
                className="px-2 py-1 rounded-pill bg-elev-2/40 border border-glass-soft font-mono text-silver text-[10px] tracking-[0.18em] uppercase"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
