import { useNavigate } from "react-router-dom";
import type { Station } from "@multiverse-fm/shared";
import { CoverShelf } from "@/components/CoverShelf";
import { CoverTile } from "@/components/CoverTile";
import { HeroBand } from "@/components/HeroBand";
import { templatePlate } from "@/lib/stationArt";
import { DUMMY_STATIONS, TEMPLATES, type Template } from "@/data/dummyStations";
import { usePlayer } from "@/stores/playerStore";

export function Home() {
  const stations = DUMMY_STATIONS;
  const hero = stations[0]; // Brooklyn 88.7 Night Cab
  const recents = stations.slice(2, 6);
  const navigate = useNavigate();
  const activeId = usePlayer((s) => s.currentStationId);
  const selectedId = usePlayer((s) => s.selectedStationId);
  const select = usePlayer((s) => s.select);
  const play = usePlayer((s) => s.play);
  const highlightId = activeId ?? selectedId ?? hero.id;

  // Tap behaviour:
  //  • Desktop (≥1024 px) opens the right panel via select().
  //  • Below that, the panel is hidden, so navigate to the World page instead.
  const onTileSelect = (id: string) => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      navigate(`/w/${id}`);
    } else {
      select(id);
    }
  };

  return (
    <div data-testid="home-page" className="-mx-3 sm:-mx-6 lg:-mx-8 -mt-6 space-y-8 sm:space-y-12">
      <HeroBand
        station={hero}
        onPlay={play}
        onExport={(id) => onTileSelect(id)}
      />

      <div className="px-3 sm:px-6 lg:px-8 pt-2 space-y-12 sm:space-y-16">
        <CoverShelf
          title="Hero stations"
          countLabel={`CURATED · ${pad(stations.length)}`}
          linkLabel="See all"
          items={stations}
          renderItem={(s: Station) => (
            <CoverTile
              station={s}
              size="lg"
              active={s.id === highlightId}
              onSelect={onTileSelect}
              onPlay={play}
            />
          )}
        />

        <CoverShelf
          title="Recently created"
          countLabel={`YOUR WORKS · ${pad(recents.length)}`}
          linkLabel="Library"
          items={recents}
          renderItem={(s: Station) => (
            <CoverTile
              station={s}
              size="md"
              creator
              active={s.id === highlightId}
              onSelect={onTileSelect}
              onPlay={play}
            />
          )}
        />

        <CoverShelf
          title="Start from a template"
          countLabel={`STUDIO · ${pad(TEMPLATES.length)}`}
          linkLabel="Open Studio"
          items={TEMPLATES}
          renderItem={(t: Template) => <TemplateTile template={t} />}
        />
      </div>
    </div>
  );
}

function TemplateTile({ template }: { template: Template }) {
  const plate = templatePlate(template.id);
  return (
    <article
      data-testid={`template-${template.id}`}
      className="
        flex-shrink-0 snap-start w-[200px] rounded-md overflow-hidden relative
        shadow-[inset_0_0_0_1px_var(--mvfm-border-soft)]
        bg-elev-2
      "
    >
      <button
        type="button"
        className="block w-full text-left"
        aria-label={`Use template: ${template.label}`}
      >
        <div
          className="relative w-full h-[140px] overflow-hidden"
          style={{ background: plate.background }}
        >
          <div className="absolute inset-0 mvfm-grain opacity-60 pointer-events-none" />
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.85) 100%)",
            }}
          />
          <div className="absolute inset-x-3 bottom-3 z-[2] flex items-end justify-between gap-2">
            <div className="min-w-0">
              <div className="font-mono text-silver2 text-[8.5px] tracking-[0.18em] uppercase truncate">
                {template.overline}
              </div>
              <div className="font-mono text-warm text-[12px] tracking-[0.04em] truncate">
                {template.label}
              </div>
            </div>
            <svg viewBox="0 0 12 12" fill="none" aria-hidden className="size-3 text-molten">
              <path
                d="M2.5 6h7m0 0L7 3.5M9.5 6L7 8.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </button>
    </article>
  );
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}
