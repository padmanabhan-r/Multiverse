import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Pack } from "@multiverse/shared";
import { api } from "@/lib/api";

export function Studio() {
  const [drafts, setDrafts] = useState<Pack[] | null>(null);
  const [published, setPublished] = useState<Pack[] | null>(null);

  useEffect(() => {
    api
      .listMyPacks()
      .then((all) => {
        setDrafts(all.filter((p) => p.status === "draft"));
        setPublished(all.filter((p) => p.status === "published"));
      })
      .catch(() => {
        setDrafts([]);
        setPublished([]);
      });
  }, []);

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

      <Section title="Drafts" testId="drafts-section" packs={drafts} draft />
      <Section title="Published" testId="published-section" packs={published} />
    </section>
  );
}

function Section({
  title,
  testId,
  packs,
  draft = false,
}: {
  title: string;
  testId: string;
  packs: Pack[] | null;
  draft?: boolean;
}) {
  if (packs === null) {
    return (
      <div data-testid={testId} className="text-silver text-[12px]">
        Loading…
      </div>
    );
  }
  if (packs.length === 0) {
    return (
      <section data-testid={testId} className="space-y-2">
        <h2 className="font-display text-warm text-lg">{title}</h2>
        <div className="text-silver text-[12px] italic">
          Nothing here yet.
        </div>
      </section>
    );
  }
  return (
    <section data-testid={testId} className="space-y-2">
      <h2 className="font-display text-warm text-lg">{title}</h2>
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {packs.map((p) => (
          <li key={p.id}>
            <Link
              to={
                draft
                  ? `/studio/draft/${p.id}`
                  : `/p/${p.id}`
              }
              data-testid={`pack-link-${p.id}`}
              className="
                block p-3 rounded-lg bg-elev-2/60 border border-glass-soft
                hover:border-molten/40 hover:bg-molten-tint/40 transition-colors
              "
            >
              <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-silver2 mb-1">
                {p.category} · {p.sample_count} samples
              </div>
              <div className="font-display text-warm">{p.title}</div>
              <div className="text-silver text-[11px] truncate">
                {p.description || "No description"}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
