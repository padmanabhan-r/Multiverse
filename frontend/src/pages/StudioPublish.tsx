import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import type { Pack, PackCategory } from "@multiverse/shared";
import { ApiError, api } from "@/lib/api";
import { cn } from "@/lib/cn";

const CATEGORIES: { value: PackCategory; label: string; credits: number }[] = [
  { value: "sfx", label: "Sound effects", credits: 1 },
  { value: "music", label: "Music", credits: 3 },
  { value: "voice_packs", label: "Voice pack", credits: 2 },
  { value: "ambient", label: "Ambient", credits: 2 },
  { value: "broadcast_packs", label: "Broadcast pack", credits: 3 },
  { value: "radio_packs", label: "Radio pack", credits: 3 },
];

interface LocationState {
  title?: string;
  category?: PackCategory;
  description?: string;
  moods?: string[];
}

export function StudioPublish() {
  const navigate = useNavigate();
  const location = useLocation();
  const [search] = useSearchParams();
  const draftIdFromUrl = search.get("packId");
  const prefill = (location.state ?? {}) as LocationState;

  const [draft, setDraft] = useState<Pack | null>(null);
  const [draftErr, setDraftErr] = useState<string | null>(null);
  const [title, setTitle] = useState(prefill.title ?? "");
  const [category, setCategory] = useState<PackCategory>(prefill.category ?? "sfx");
  const [description, setDescription] = useState(prefill.description ?? "");
  const [priceDollars, setPriceDollars] = useState("2");
  const [tagsRaw, setTagsRaw] = useState("");
  const [multiplier, setMultiplier] = useState("3");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing draft if ?packId= present.
  useEffect(() => {
    if (!draftIdFromUrl) return;
    api
      .getPack(draftIdFromUrl)
      .then((p) => {
        setDraft(p);
        setTitle(p.title);
        setCategory(p.category as PackCategory);
        setDescription(p.description || "");
        setPriceDollars((p.price_cents / 100).toFixed(2));
        setTagsRaw((p.tags || []).join(", "));
        setMultiplier(String(p.license_commercial_multiplier || 3));
      })
      .catch((e) =>
        setDraftErr(e instanceof Error ? e.message : "couldn't load draft"),
      );
  }, [draftIdFromUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    const price = Math.round(parseFloat(priceDollars) * 100);
    if (isNaN(price) || price < 50 || price > 1500) {
      setError("Price must be between $0.50 and $15.");
      return;
    }
    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const multiplierVal = parseFloat(multiplier) || 3;

    setBusy(true);
    try {
      let pack: Pack;
      if (draft) {
        // Existing builder draft → PATCH metadata then publish.
        pack = await api.updatePack(draft.id, {
          title: title.trim(),
          description: description.trim(),
          price_cents: price,
          tags,
          license_commercial_multiplier: multiplierVal,
        });
      } else {
        // No builder draft → legacy fast-track: create + publish in one go.
        pack = await api.createDraft({
          title: title.trim(),
          category,
          description: description.trim(),
          price_cents: price,
          tags,
          moods: prefill.moods ?? [],
          license_commercial_multiplier: multiplierVal,
          style_profile: {},
        });
      }
      await api.publishPack(pack.id);
      navigate(`/p/${pack.id}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setError(
          `Pack isn't ready to publish yet: ${err.message}. Add at least one sample in the builder first.`,
        );
      } else {
        setError(err instanceof Error ? err.message : "Publish failed. Try again.");
      }
      setBusy(false);
    }
  };

  return (
    <section className="max-w-xl mx-auto py-8 space-y-6">
      <div className="space-y-1">
        <div className="font-mono text-silver2 text-[10px] tracking-[0.32em] uppercase">
          Studio · Publish
        </div>
        <h1 className="font-display text-warm text-3xl tracking-tight">
          {draft ? "Set details + publish" : "Publish to marketplace"}
        </h1>
        <p className="text-silver text-[14px]">
          {draft
            ? `Editing draft "${draft.title}" · ${draft.sample_count} samples ready.`
            : "Set your price. Ship it. Buyers can purchase instantly."}
        </p>
        {draftErr && (
          <div data-testid="publish-draft-err" className="text-molten text-[12px]">
            {draftErr}
          </div>
        )}
      </div>

      <form
        data-testid="studio-publish-form"
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <Field label="Pack name" htmlFor="pub-title">
          <input
            id="pub-title"
            data-testid="publish-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Jungle Theme SFX Pack"
            className={inputCls}
          />
        </Field>

        {!draft && (
          <Field label="Category" htmlFor="pub-category">
            <select
              id="pub-category"
              data-testid="publish-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as PackCategory)}
              className={inputCls}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label} · {c.credits} ⚡
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Description" htmlFor="pub-desc">
          <textarea
            id="pub-desc"
            data-testid="publish-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's in this pack. Where to use it."
            rows={3}
            className={inputCls}
          />
        </Field>

        <Field label="Price (USD)" htmlFor="pub-price">
          <input
            id="pub-price"
            data-testid="publish-price"
            type="number"
            min="0.50"
            max="15"
            step="0.50"
            value={priceDollars}
            onChange={(e) => setPriceDollars(e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field label="Tags (comma-separated)" htmlFor="pub-tags">
          <input
            id="pub-tags"
            data-testid="publish-tags"
            type="text"
            value={tagsRaw}
            onChange={(e) => setTagsRaw(e.target.value)}
            placeholder="noir, rain, city"
            className={inputCls}
          />
        </Field>

        <Field label="Commercial license multiplier" htmlFor="pub-mult">
          <select
            id="pub-mult"
            data-testid="publish-multiplier"
            value={multiplier}
            onChange={(e) => setMultiplier(e.target.value)}
            className={inputCls}
          >
            {["1.5", "2", "3", "5", "10"].map((m) => (
              <option key={m} value={m}>
                {m}× of personal price
              </option>
            ))}
          </select>
        </Field>

        {error && (
          <div data-testid="publish-error" className="text-molten text-[12px]">
            {error}
          </div>
        )}

        <button
          type="submit"
          data-testid="publish-submit"
          disabled={busy}
          style={{ color: "#1a0700" }}
          className="
            w-full px-4 py-3 rounded-md bg-molten font-mono text-[11px]
            tracking-[0.22em] uppercase font-semibold hover:bg-molten-glow
            shadow-bloom disabled:opacity-50
          "
        >
          {busy ? "Publishing…" : draft ? "Publish pack" : "Create + publish"}
        </button>
      </form>
    </section>
  );
}

const inputCls =
  "w-full px-3 py-2.5 rounded-md bg-elev-2/60 border border-glass-soft " +
  "text-warm text-[13px] placeholder:text-silver/60";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1" htmlFor={htmlFor}>
      <span
        className={cn(
          "block font-mono text-silver2 text-[10px] tracking-[0.28em] uppercase",
        )}
      >
        {label}
      </span>
      {children}
    </label>
  );
}
