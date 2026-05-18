import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type MarketplaceVoice } from "@/lib/api";
import { plateFor } from "@/lib/stationArt";
import { cn } from "@/lib/cn";

export function Voices() {
  const [voices, setVoices] = useState<MarketplaceVoice[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .listMarketplaceVoices()
      .then(setVoices)
      .catch((e) => setErr(e instanceof Error ? e.message : "load failed"));
  }, []);

  if (err) return <div className="text-molten">{err}</div>;
  if (!voices)
    return (
      <div data-testid="voices-loading" className="text-silver">
        Loading…
      </div>
    );

  return (
    <section className="space-y-6 pb-8" data-testid="voices-page">
      <header className="space-y-1">
        <div className="font-mono text-silver2 text-[10px] tracking-[0.32em] uppercase">
          Voice marketplace
        </div>
        <h1 className="mvfm-display text-warm text-[44px] sm:text-[60px] leading-[0.95]">
          Buy a voice. Use it forever.
        </h1>
        <p className="text-silver text-[14px] max-w-2xl">
          Pay once in credits → lifetime access. Generate TTS through any
          voice you own. Royalty-free; creators earn 70% of every sale.
        </p>
      </header>

      {voices.length === 0 ? (
        <div className="text-silver italic text-[13px]">
          No voices published yet.
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {voices.map((v) => (
            <li key={v.id}>
              <VoiceTile voice={v} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function VoiceTile({ voice }: { voice: MarketplaceVoice }) {
  const plate = plateFor(voice.id);
  return (
    <Link
      to={`/v/${voice.id}`}
      data-testid={`voice-tile-${voice.id}`}
      className={cn(
        "group block rounded-xl overflow-hidden border border-glass-soft",
        "hover:border-molten/40 transition-colors duration-tune ease-tune",
      )}
    >
      <div
        className="aspect-[5/3] relative"
        style={{
          background: voice.cover_art_url
            ? `center / cover no-repeat url('${voice.cover_art_url}'), ${plate.background}`
            : plate.background,
        }}
      >
        <span
          aria-hidden
          className="absolute inset-0 mvfm-grain opacity-40 pointer-events-none"
        />
        <span
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, transparent 40%, rgba(10,10,12,0.85) 100%)",
          }}
        />
        <div className="absolute top-3 left-3 font-mono text-silver2 text-[9px] tracking-[0.28em] uppercase">
          Voice
        </div>
        <div className="absolute bottom-3 left-3 right-3">
          <div className="mvfm-display text-warm text-[20px] leading-[0.95] truncate">
            {voice.title}
          </div>
          <div className="font-mono text-silver text-[10px] tracking-[0.18em] uppercase mt-1 truncate">
            By {voice.creator_name}
          </div>
        </div>
      </div>
      <div className="p-3 bg-elev-2/40 flex items-center justify-between">
        <span className="text-silver text-[12px] line-clamp-1">
          {voice.description || "—"}
        </span>
        <span className="font-mono text-molten text-[13px] tracking-[0.1em] flex-shrink-0 ml-3">
          {voice.price_credits} ⚡
        </span>
      </div>
    </Link>
  );
}
