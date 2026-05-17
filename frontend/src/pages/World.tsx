import { Link, useParams } from "react-router-dom";
import { cn } from "@/lib/cn";
import { plateFor } from "@/lib/stationArt";
import { DUMMY_STATIONS } from "@/data/dummyStations";
import { usePlayer } from "@/stores/playerStore";

export function World() {
  const { stationId } = useParams<{ stationId: string }>();
  const station = stationId
    ? DUMMY_STATIONS.find((s) => s.id === stationId)
    : null;

  const play = usePlayer((s) => s.play);
  const select = usePlayer((s) => s.select);
  const currentId = usePlayer((s) => s.currentStationId);
  const isPlayingThis = currentId === station?.id;

  if (!station) {
    return <WorldNotFound id={stationId} />;
  }

  const plate = plateFor(station.id);
  const realityLabel = station.reality_type.replace("_", " ");

  const fields: Array<[string, string]> = [
    ["Reality type", realityLabel],
    ["Year / era", station.year_or_era],
    ["Place", station.place],
    ["Format", station.broadcast_format],
    ["DJ persona", station.dj_persona],
    ["Language register", station.language_register],
    ["Ad economy", station.ad_economy.join(" · ")],
    ["Headline style", station.headline_style],
    ["Weather style", station.weather_style],
    ["Ambient palette", station.ambient_palette.join(" · ")],
    ["Signal texture", station.signal_texture],
    ["Mastering preset", station.mastering_preset],
  ];

  return (
    <div data-testid="world-page" className="-mx-3 sm:-mx-6 lg:-mx-8 -mt-6">
      {/* Hero plate band */}
      <section
        data-testid="world-hero"
        className="
          relative w-full overflow-hidden
          h-[360px] sm:h-[460px] lg:h-[520px]
          border-b border-glass-soft
        "
      >
        <div
          data-testid="world-plate"
          className="absolute inset-0"
          style={{ background: plate.background }}
        />
        {plate.accentLayer && (
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{ background: plate.accentLayer }}
          />
        )}
        <div aria-hidden className="absolute inset-0 mvfm-grain opacity-60 pointer-events-none" />
        {/* Vignette */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background: [
              "radial-gradient(ellipse at 30% 65%, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.55) 90%, rgba(0,0,0,0.85) 100%)",
              "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 50%, rgba(10,10,12,0.92) 100%)",
            ].join(", "),
          }}
        />

        {/* Top breadcrumb / back */}
        <div
          className="
            absolute top-3 left-3 sm:top-4 sm:left-6 z-[3]
            flex items-center gap-2
            font-mono text-silver2 text-[9.5px] tracking-[0.22em] uppercase
          "
        >
          <Link
            to="/"
            data-testid="world-back"
            className="
              inline-flex items-center gap-1.5 px-2 py-1 rounded-md
              hover:text-warm transition-colors duration-fast ease-tune
            "
          >
            <svg viewBox="0 0 12 12" fill="none" aria-hidden className="size-3">
              <path
                d="M8 2L4 6l4 4"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Back to library
          </Link>
        </div>

        <div
          className="
            absolute hidden sm:flex top-4 right-6 z-[3]
            gap-3 font-mono text-silver2 text-[9.5px] tracking-[0.18em] uppercase
          "
        >
          <span>
            Reality <b className="font-normal text-silver">{realityLabel}</b>
          </span>
          <span className="opacity-50">·</span>
          <span>
            Era <b className="font-normal text-silver">{station.year_or_era}</b>
          </span>
          <span className="opacity-50">·</span>
          <span>
            Tier <b className="font-normal text-molten">{station.tier_required}</b>
          </span>
        </div>

        {/* Bottom-left overlay block — glass instrument panel */}
        <div
          data-testid="world-overlay"
          className={cn(
            "absolute left-3 sm:left-6 lg:left-10 z-[3]",
            "bottom-6 sm:bottom-10 max-w-[92%] sm:max-w-[640px]",
            "p-4 sm:p-6 rounded-xl",
            "mvfm-glass mvfm-glass-top-edge",
          )}
        >
          <div
            className="
              flex items-center gap-2.5 mb-3
              font-mono text-silver2 text-[10px] tracking-[0.16em] uppercase
            "
          >
            <span className="text-molten inline-flex items-center gap-1.5">
              <span
                className="size-1.5 rounded-full bg-molten"
                style={{ boxShadow: "0 0 8px var(--mvfm-molten-glow)" }}
                aria-hidden
              />
              {isPlayingThis ? "Now on air" : "Hero world"}
            </span>
            <span className="size-0.5 rounded-full bg-silver2/60" aria-hidden />
            <span>{realityLabel}</span>
            <span className="size-0.5 rounded-full bg-silver2/60" aria-hidden />
            <span>{station.year_or_era}</span>
          </div>

          <h1
            data-testid="world-title"
            className="
              font-mono font-semibold text-warm
              text-[32px] sm:text-[44px] lg:text-[56px]
              leading-[0.95] tracking-[-0.01em]
              mb-2 sm:mb-3
            "
            style={{ fontFeatureSettings: '"ss01","ss02"' }}
          >
            {station.station_name}
          </h1>

          <p
            data-testid="world-slogan"
            className="
              font-body italic text-warm/85
              text-[13px] sm:text-[15px] leading-[1.45]
              max-w-[480px] mb-4 sm:mb-5 text-balance
            "
          >
            “{station.station_slogan}”
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="world-play"
              onClick={() => play(station.id)}
              style={{
                color: "#1a0700",
                background: "var(--mvfm-molten)",
                boxShadow:
                  "0 0 0 1px rgba(255,106,31,0.7), 0 10px 30px -10px rgba(255,106,31,0.8), inset 0 1px 0 rgba(255,255,255,0.28)",
              }}
              className="
                inline-flex items-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-md
                font-mono text-[10.5px] tracking-[0.12em] uppercase font-semibold
                hover:brightness-110 transition-all duration-fast ease-tune
              "
            >
              <span
                aria-hidden
                className="block w-0 h-0 -ml-0.5"
                style={{
                  borderLeft: "7px solid #1a0700",
                  borderTop: "5px solid transparent",
                  borderBottom: "5px solid transparent",
                }}
              />
              Play 4-min block
            </button>
            <button
              type="button"
              data-testid="world-ask"
              onClick={() => select(station.id)}
              className="
                inline-flex items-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-md
                text-warm font-mono text-[10.5px] tracking-[0.12em] uppercase font-semibold
                transition-all duration-fast ease-tune
                hover:brightness-110
              "
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03))",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.12), inset 0 0 0 1px rgba(255,255,255,0.08)",
              }}
            >
              Ask the DJ
            </button>
            <button
              type="button"
              data-testid="world-export"
              onClick={() => select(station.id)}
              className="
                inline-flex items-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-md
                text-warm font-mono text-[10.5px] tracking-[0.12em] uppercase font-semibold
                transition-all duration-fast ease-tune
                hover:brightness-110
              "
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03))",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.12), inset 0 0 0 1px rgba(255,255,255,0.08)",
              }}
            >
              Export world pack
            </button>
          </div>
        </div>
      </section>

      {/* Schema fields */}
      <section
        data-testid="world-schema"
        className="px-3 sm:px-6 lg:px-10 py-8 sm:py-10 max-w-5xl"
      >
        <div className="flex items-baseline justify-between mb-4 sm:mb-6">
          <h2 className="font-mono text-warm text-[12px] tracking-[0.18em] uppercase font-semibold">
            World data
          </h2>
          <span className="font-mono text-silver2 text-[9.5px] tracking-[0.18em] uppercase">
            station schema · {fields.length} fields
          </span>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 sm:gap-y-5">
          {fields.map(([k, v], i) => (
            <div
              key={k}
              data-testid={`schema-field-${i}`}
              className="border-b border-glass-soft pb-3 sm:pb-4"
            >
              <div className="flex items-baseline justify-between gap-3 mb-1.5">
                <dt className="font-mono text-silver2 text-[9px] tracking-[0.22em] uppercase">
                  {k}
                </dt>
                <span className="font-mono text-silver2/60 text-[8.5px] tracking-[0.22em]">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <dd className="text-warm text-[13px] leading-[1.5]">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

function WorldNotFound({ id }: { id: string | undefined }) {
  return (
    <div
      data-testid="world-not-found"
      className="min-h-[60vh] grid place-items-center text-center p-6"
    >
      <div className="space-y-3">
        <div className="font-mono text-silver2 text-[10px] tracking-[0.28em] uppercase">
          Signal lost
        </div>
        <h1 className="font-display text-warm text-2xl tracking-tight">
          No station at <span className="text-molten">/w/{id ?? "?"}</span>
        </h1>
        <Link
          to="/"
          className="
            inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md
            bg-elev-2/60 border border-glass-soft text-silver hover:text-warm
            font-mono text-[10.5px] tracking-[0.18em] uppercase
            transition-colors duration-fast ease-tune
          "
        >
          ← Back to library
        </Link>
      </div>
    </div>
  );
}
