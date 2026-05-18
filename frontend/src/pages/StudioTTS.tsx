import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, api, type MarketplaceVoice, type TTSResult } from "@/lib/api";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export function StudioTTS() {
  const qc = useQueryClient();
  const [voices, setVoices] = useState<MarketplaceVoice[] | null>(null);
  const [voiceId, setVoiceId] = useState<string>("");
  const [text, setText] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TTSResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .listOwnedVoices()
      .then((vs) => {
        setVoices(vs);
        if (vs.length > 0) setVoiceId(vs[0].id);
      })
      .catch(() => setVoices([]));
  }, []);

  async function generate() {
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const out = await api.generateTts(voiceId, text);
      setResult(out);
      qc.invalidateQueries({ queryKey: ["me", "credits"] });
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 402) setErr("Not enough credits. Top up first.");
        else if (e.status === 403) setErr("You don't own this voice.");
        else setErr(e.message || "TTS failed");
      } else {
        setErr(e instanceof Error ? e.message : "TTS failed");
      }
    } finally {
      setBusy(false);
    }
  }

  if (voices === null)
    return (
      <div data-testid="tts-loading" className="text-silver">
        Loading owned voices…
      </div>
    );

  return (
    <section className="space-y-6 pb-8" data-testid="studio-tts">
      <header className="space-y-1">
        <div className="font-mono text-silver2 text-[10px] tracking-[0.32em] uppercase">
          Studio · TTS composer
        </div>
        <h1 className="mvfm-display text-warm text-[40px] sm:text-[56px] leading-[0.95]">
          Run TTS through an owned voice.
        </h1>
        <p className="text-silver text-[13px] max-w-2xl">
          Pick a voice you own. Type a script. Each ≤5 min generation costs 1 ⚡.
          30% of every credit you spend flows back to the voice creator.
        </p>
      </header>

      {voices.length === 0 ? (
        <div className="p-6 rounded-xl bg-elev-2/40 border border-glass-soft space-y-3">
          <div className="text-warm">You don't own any voices yet.</div>
          <Link
            to="/voices"
            data-testid="tts-empty-cta"
            className="
              inline-block px-3.5 py-2 rounded-md bg-molten font-mono
              text-[10px] tracking-[0.22em] uppercase font-semibold
              shadow-bloom
            "
            style={{ color: "#1a0700" }}
          >
            Browse voices
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,260px] gap-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="font-mono text-silver2 text-[10px] tracking-[0.28em] uppercase">
                Voice
              </label>
              <select
                data-testid="tts-voice-select"
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value)}
                className="
                  w-full p-2.5 rounded-md bg-elev-2/60 border border-glass-soft
                  text-warm text-[13px]
                "
              >
                {voices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title} · by {v.creator_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-mono text-silver2 text-[10px] tracking-[0.28em] uppercase">
                Script
              </label>
              <textarea
                data-testid="tts-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type what you want the voice to say…"
                rows={6}
                className="
                  w-full p-3 rounded-md bg-elev-2/60 border border-glass-soft
                  text-warm text-[14px] placeholder:text-silver/60
                "
              />
              <div className="font-mono text-silver2 text-[10px] tracking-[0.18em]">
                {text.length} chars · est. ~{Math.max(1, Math.ceil(text.length / 4500))} ⚡
              </div>
            </div>

            <button
              type="button"
              data-testid="tts-generate"
              onClick={generate}
              disabled={busy || !text.trim() || !voiceId}
              style={{ color: "#1a0700" }}
              className="
                px-4 py-2.5 rounded-md bg-molten font-mono text-[11px]
                tracking-[0.22em] uppercase font-semibold hover:bg-molten-glow
                shadow-bloom disabled:opacity-40
              "
            >
              {busy ? "Generating…" : "Generate"}
            </button>

            {err && <div className="text-molten text-[12px]">{err}</div>}

            {result && (
              <div
                data-testid="tts-result"
                className="space-y-2 p-4 rounded-md bg-elev-2/40 border border-glass-soft"
              >
                <div className="font-mono text-silver2 text-[10px] tracking-[0.22em] uppercase">
                  Generated · {result.credits_spent} ⚡ debited
                </div>
                <audio
                  src={`${API_BASE}${result.audio_url}`}
                  controls
                  autoPlay
                  className="w-full"
                />
                <a
                  href={`${API_BASE}${result.audio_url}`}
                  download
                  className="font-mono text-molten text-[10px] tracking-[0.22em] uppercase"
                >
                  Download mp3 →
                </a>
              </div>
            )}
          </div>

          <aside className="p-4 rounded-xl bg-elev-2/40 border border-glass-soft space-y-3">
            <div className="font-mono text-silver2 text-[10px] tracking-[0.28em] uppercase">
              How it's priced
            </div>
            <ul className="text-silver text-[12px] space-y-1 list-disc list-inside">
              <li>1 ⚡ per ≤5 min of output</li>
              <li>Charged on success only</li>
              <li>30% goes to the voice creator</li>
              <li>Lifetime voice access — no expiry</li>
            </ul>
            <Link
              to="/credits"
              className="
                block w-full text-center px-3 py-2 rounded-md
                bg-elev-2/60 border border-glass-soft text-silver
                hover:text-warm font-mono text-[10px] tracking-[0.22em] uppercase
              "
            >
              View ledger
            </Link>
          </aside>
        </div>
      )}
    </section>
  );
}
