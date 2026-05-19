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
  const [confirmDelete, setConfirmDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

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

  function requestDelete(id: string, title: string) {
    setDeleteErr(null);
    setConfirmDelete({ id, title });
  }

  async function performDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    setDeleteErr(null);
    try {
      await api.deletePack(confirmDelete.id);
      setDrafts((prev) =>
        prev ? prev.filter((p) => p.id !== confirmDelete.id) : prev,
      );
      setConfirmDelete(null);
    } catch (e) {
      setDeleteErr(e instanceof Error ? e.message : "delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section data-testid="studio-page" className="space-y-8 pb-8">
      <header className="space-y-2">
        <div className="font-mono text-silver2 text-[10px] tracking-[0.32em] uppercase">
          Studio
        </div>
        <h1 className="mvfm-display text-warm text-3xl sm:text-[44px] leading-[0.98] tracking-tight">
          Build something.
        </h1>
        <p className="text-silver text-[14px] max-w-prose">
          Pick a starting point — generate samples, compose TTS, or bundle
          your published packs.
        </p>
      </header>

      <div
        data-testid="studio-entries"
        className="grid grid-cols-1 sm:grid-cols-3 gap-3"
      >
        <EntryCard
          to="/studio/new"
          testId="cta-new-pack"
          title="New pack"
          blurb="Generate music, SFX, or ambient samples one at a time. Cover art included."
          icon={
            <svg viewBox="0 0 24 24" fill="none" aria-hidden className="size-5">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          }
        />
        <EntryCard
          to="/studio/tts"
          testId="cta-tts"
          title="TTS composer"
          blurb="Type text, pick an owned voice, get back an MP3. Buyers of any voice can use it here."
          icon={
            <svg viewBox="0 0 24 24" fill="none" aria-hidden className="size-5">
              <path
                d="M4 6h12M4 12h16M4 18h10"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
              <path
                d="M18 18l3-3 3 3"
                transform="translate(-3 -6) scale(0.7)"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
        />
        <EntryCard
          to="/studio/bundle/new"
          testId="cta-new-bundle"
          title="New bundle"
          blurb="Group 2+ published packs and sell them together at a discounted price."
          icon={
            <svg viewBox="0 0 24 24" fill="none" aria-hidden className="size-5">
              <path
                d="M3 8l9-5 9 5-9 5-9-5zm0 8l9 5 9-5M3 12l9 5 9-5"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          }
        />
      </div>

      <Section
        title="Drafts"
        testId="drafts-section"
        packs={drafts}
        draft
        onDelete={requestDelete}
      />
      <hr className="border-glass-soft" />
      <Section title="Published" testId="published-section" packs={published} />

      {confirmDelete && (
        <DeleteConfirmModal
          title={confirmDelete.title}
          busy={deleting}
          error={deleteErr}
          onConfirm={performDelete}
          onCancel={() => {
            if (deleting) return;
            setConfirmDelete(null);
            setDeleteErr(null);
          }}
        />
      )}
    </section>
  );
}

function EntryCard({
  to,
  testId,
  title,
  blurb,
  icon,
  accent = "default",
}: {
  to: string;
  testId: string;
  title: string;
  blurb: string;
  icon: React.ReactNode;
  accent?: "default" | "primary";
}) {
  const primary = accent === "primary";
  return (
    <Link
      to={to}
      data-testid={testId}
      className={cn(
        "group relative rounded-xl p-5 sm:p-6 flex flex-col gap-3",
        "border-2 transition-all duration-tune ease-tune",
        "hover:-translate-y-0.5",
        primary
          ? "border-molten/50 bg-molten-tint shadow-[0_0_40px_-14px_var(--mvfm-molten-dim)] hover:border-molten/70"
          : "border-glass bg-elev-2/40 hover:border-molten/50 hover:bg-molten-tint/40",
      )}
    >
      <div
        className={cn(
          "size-10 rounded-lg flex items-center justify-center",
          "border transition-colors duration-tune ease-tune",
          primary
            ? "border-molten/50 bg-molten/20 text-molten"
            : "border-glass-soft bg-elev-2/60 text-silver group-hover:text-molten group-hover:border-molten/40",
        )}
      >
        {icon}
      </div>
      <div className="flex items-center gap-2">
        <h3 className="mvfm-display text-warm text-[20px] leading-[1.05]">
          {title}
        </h3>
        <span
          className={cn(
            "text-[14px] -translate-x-1 transition-transform duration-tune ease-tune",
            "group-hover:translate-x-0",
            primary ? "text-molten" : "text-silver2 group-hover:text-molten",
          )}
          aria-hidden
        >
          →
        </span>
      </div>
      <p className="text-silver text-[12.5px] leading-[1.45]">{blurb}</p>
    </Link>
  );
}

function DeleteConfirmModal({
  title,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="delete-confirm-modal"
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      <button
        type="button"
        aria-label="Cancel"
        onClick={onCancel}
        disabled={busy}
        className="absolute inset-0 bg-base/80 backdrop-blur-sm"
      />
      <div
        className="
          relative w-full max-w-md rounded-xl border border-glass-soft
          bg-elev-2 shadow-panel p-6 space-y-4
        "
      >
        <div className="space-y-1">
          <div className="font-mono text-molten text-[10px] tracking-[0.28em] uppercase">
            Delete draft
          </div>
          <h2 className="mvfm-display text-warm text-[22px] leading-[1.1]">
            Delete "{title}"?
          </h2>
          <p className="text-silver text-[13px] leading-[1.5]">
            This removes the draft and all its samples. It can't be undone.
          </p>
        </div>

        {error && (
          <div
            data-testid="delete-error"
            className="
              p-2.5 rounded-md border border-glass-soft bg-elev-2/40
              font-mono text-[10.5px] text-silver
            "
          >
            <span className="text-molten uppercase tracking-[0.18em] text-[9px]">
              Failed
            </span>
            <div className="mt-1 text-warm/85 break-all">{error}</div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 justify-end pt-1">
          <button
            type="button"
            data-testid="delete-cancel"
            onClick={onCancel}
            disabled={busy}
            className="
              inline-flex items-center px-4 py-2 rounded-md
              bg-elev-2/60 border border-glass-soft
              text-silver hover:text-warm hover:border-glass
              font-mono text-[10.5px] tracking-[0.22em] uppercase
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="delete-confirm"
            onClick={onConfirm}
            disabled={busy}
            style={{ color: "#1a0700" }}
            className="
              inline-flex items-center px-4 py-2 rounded-md
              bg-molten hover:bg-molten-glow shadow-bloom
              font-mono text-[10.5px] tracking-[0.22em] uppercase font-semibold
              disabled:opacity-60 disabled:cursor-wait
            "
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
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
            absolute top-10 right-2 z-10 size-7 rounded-full
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
