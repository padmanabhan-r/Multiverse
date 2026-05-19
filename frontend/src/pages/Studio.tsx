import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Pack } from "@multiverse/shared";
import { api } from "@/lib/api";
import { plateFor } from "@/lib/stationArt";
import { cn } from "@/lib/cn";

const CATEGORY_SHORT: Record<string, string> = {
  sfx: "SFX",
  music: "Music",
  voice_packs: "Voice",
  ambient: "Ambient",
  radio_packs: "Radio",
  broadcast_packs: "Broadcast",
};

export function Studio() {
  const [drafts, setDrafts] = useState<Pack[] | null>(null);
  const [published, setPublished] = useState<Pack[] | null>(null);

  function loadPacks() {
    return api
      .listMyPacks()
      .then((all) => {
        setDrafts(all.filter((p) => p.status === "draft"));
        setPublished(all.filter((p) => p.status === "published"));
      })
      .catch(() => {
        setDrafts([]);
        setPublished([]);
      });
  }

  useEffect(() => {
    loadPacks();
  }, []);

  async function deleteDraft(id: string, title: string) {
    if (!window.confirm(`Delete draft "${title}"? This can't be undone.`)) {
      return;
    }
    try {
      await api.deletePack(id);
      setDrafts((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "delete failed");
    }
  }

  return (
    <section data-testid="studio-page" className="space-y-8 pb-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <div className="font-mono text-silver2 text-[10px] tracking-[0.32em] uppercase">
            Studio
          </div>
          <h1 className="font-display text-warm text-3xl sm:text-[40px] tracking-tight">
            Build something.
          </h1>
          <p className="text-silver text-[14px] max-w-prose">
            Generate samples one at a time. Bundle published packs for cross-sell.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/studio/new"
            data-testid="cta-new-pack"
            className="
              px-4 py-2 rounded-md bg-molten text-[11px] tracking-[0.22em]
              uppercase font-mono font-semibold shadow-bloom hover:bg-molten-glow
            "
            style={{ color: "#1a0700" }}
          >
            + New pack
          </Link>
          <Link
            to="/studio/tts"
            data-testid="cta-tts"
            className="
              px-4 py-2 rounded-md bg-elev-2/60 border border-glass-soft
              text-silver hover:text-warm font-mono text-[11px]
              tracking-[0.22em] uppercase
            "
          >
            TTS composer
          </Link>
          <Link
            to="/studio/bundle/new"
            data-testid="cta-new-bundle"
            className="
              px-4 py-2 rounded-md bg-elev-2/60 border border-glass-soft
              text-silver hover:text-warm font-mono text-[11px]
              tracking-[0.22em] uppercase
            "
          >
            + New bundle
          </Link>
        </div>
      </header>

      <Section
        title="Drafts"
        testId="drafts-section"
        packs={drafts}
        draft
        onDelete={deleteDraft}
      />
      <hr className="border-glass-soft" />
      <Section title="Published" testId="published-section" packs={published} />
    </section>
  );
}

function Section({
  title,
  testId,
  packs,
  draft = false,
  onDelete,
}: {
  title: string;
  testId: string;
  packs: Pack[] | null;
  draft?: boolean;
  onDelete?: (id: string, title: string) => void;
}) {
  if (packs === null) {
    return (
      <section data-testid={testId} className="space-y-3">
        <SectionHeader title={title} count={null} />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-lg bg-elev-2 animate-pulse shadow-[inset_0_0_0_1px_var(--mvfm-border-soft)]"
            />
          ))}
        </div>
      </section>
    );
  }
  if (packs.length === 0) {
    return (
      <section data-testid={testId} className="space-y-3">
        <SectionHeader title={title} count={0} />
        <div className="rounded-lg border border-dashed border-glass-soft bg-elev-2/30 px-4 py-6 text-center">
          <p className="text-silver text-[12px]">
            {draft
              ? "No drafts yet. Start a new pack to see it here."
              : "Nothing published yet. Finish a draft to publish it."}
          </p>
        </div>
      </section>
    );
  }
  return (
    <section data-testid={testId} className="space-y-3">
      <SectionHeader title={title} count={packs.length} />
      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {packs.map((p) => (
          <li key={p.id}>
            <StudioPackCard pack={p} draft={draft} onDelete={onDelete} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function SectionHeader({
  title,
  count,
}: {
  title: string;
  count: number | null;
}) {
  return (
    <div className="flex items-baseline justify-between px-1">
      <h2 className="font-mono text-warm text-[12px] tracking-[0.22em] uppercase font-semibold">
        {title}
      </h2>
      {count !== null && (
        <span className="font-mono text-silver2 text-[10px] tracking-[0.22em] uppercase">
          {count.toString().padStart(2, "0")} {count === 1 ? "pack" : "packs"}
        </span>
      )}
    </div>
  );
}

function StudioPackCard({
  pack,
  draft,
  onDelete,
}: {
  pack: Pack;
  draft: boolean;
  onDelete?: (id: string, title: string) => void;
}) {
  const plate = plateFor(pack.id);
  const price =
    pack.price_credits ?? Math.round((pack.price_cents ?? 0) / 10);
  const to = draft ? `/studio/draft/${pack.id}` : `/p/${pack.id}`;
  return (
    <div className="relative group">
      <Link
        to={to}
        data-testid={`pack-link-${pack.id}`}
        className={cn(
          "block rounded-lg overflow-hidden",
          "border border-glass-soft hover:border-molten/40",
          "transition-colors duration-tune ease-tune",
        )}
      >
      <div
        className="aspect-square relative"
        style={{
          background: pack.cover_art_url
            ? `center / cover no-repeat url('${pack.cover_art_url}'), ${plate.background}`
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
              "linear-gradient(180deg, transparent 45%, rgba(10,10,12,0.88) 100%)",
          }}
        />
        <div className="absolute top-2 left-2 font-mono text-silver2 text-[9px] tracking-[0.24em] uppercase">
          {CATEGORY_SHORT[pack.category] ?? pack.category}
        </div>
        {draft && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-pill bg-molten-tint border border-molten/40 font-mono text-molten text-[8.5px] tracking-[0.22em] uppercase">
            Draft
          </div>
        )}
        <div className="absolute bottom-2 left-2 right-2">
          <div className="mvfm-display text-warm text-[14px] leading-[0.95] truncate">
            {pack.title}
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="font-mono text-silver text-[9.5px] tracking-[0.14em]">
              {pack.sample_count} {pack.sample_count === 1 ? "sample" : "samples"}
            </span>
            <span className="font-mono text-molten text-[10px] tracking-[0.08em]">
              {price} ⚡
            </span>
          </div>
        </div>
      </div>
      </Link>
      {draft && onDelete && (
        <button
          type="button"
          data-testid={`pack-delete-${pack.id}`}
          aria-label={`Delete draft ${pack.title}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(pack.id, pack.title);
          }}
          className="
            absolute top-2 right-12 z-10 size-7 rounded-full
            bg-elev-2/80 border border-glass-soft backdrop-blur-sm
            text-silver hover:text-molten hover:border-molten/60
            opacity-0 group-hover:opacity-100 focus:opacity-100
            transition-opacity duration-fast ease-tune
            flex items-center justify-center
          "
        >
          <svg viewBox="0 0 14 14" fill="none" aria-hidden className="size-3.5">
            <path d="M3 4h8m-6 0V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1m1 0v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4m2 2v5m2-5v5"
              stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
