import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import type { PackCategory } from "@multiverse-fm/shared";
import { cn } from "@/lib/cn";
import { api } from "@/lib/api";

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
  const prefill = (location.state ?? {}) as LocationState;

  const [title, setTitle] = useState(prefill.title ?? "");
  const [category, setCategory] = useState<PackCategory>(prefill.category ?? "sfx");
  const [description, setDescription] = useState(prefill.description ?? "");
  const [priceDollars, setPriceDollars] = useState("7");
  const [tagsRaw, setTagsRaw] = useState("");
  const [multiplier, setMultiplier] = useState("3");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    const price = Math.round(parseFloat(priceDollars) * 100);
    if (isNaN(price) || price < 100 || price > 5000) {
      setError("Price must be between $1 and $50.");
      return;
    }

    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    setBusy(true);
    try {
      const draft = await api.createDraft({
        title: title.trim(),
        category,
        description: description.trim(),
        price_cents: price,
        tags,
        moods: prefill.moods ?? [],
        license_commercial_multiplier: parseFloat(multiplier) || 3,
        style_profile: {},
      });
      await api.publishPack(draft.id);
      navigate(`/p/${draft.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed. Try again.");
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
          Publish to marketplace
        </h1>
        <p className="text-silver text-[14px]">
          Set your price. Ship it. Buyers can purchase instantly.
        </p>
      </div>

      <form
        data-testid="studio-publish-form"
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        {/* Title */}
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

        {/* Category */}
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
                {c.label} ({c.credits} credit{c.credits > 1 ? "s" : ""} to generate)
              </option>
            ))}
          </select>
        </Field>

        {/* Description */}
        <Field label="Description" htmlFor="pub-desc">
          <textarea
            id="pub-desc"
            data-testid="publish-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What's in this pack? Where should buyers use it?"
            className={cn(inputCls, "resize-none")}
          />
        </Field>

        {/* Price */}
        <Field label="Price (USD)" htmlFor="pub-price" hint="$1 – $50">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-silver2 text-[13px]">
              $
            </span>
            <input
              id="pub-price"
              data-testid="publish-price"
              type="number"
              min="1"
              max="50"
              step="1"
              value={priceDollars}
              onChange={(e) => setPriceDollars(e.target.value)}
              className={cn(inputCls, "pl-7")}
            />
          </div>
        </Field>

        {/* Tags */}
        <Field label="Tags" htmlFor="pub-tags" hint="Comma-separated, e.g. jungle, nature, game">
          <input
            id="pub-tags"
            data-testid="publish-tags"
            type="text"
            value={tagsRaw}
            onChange={(e) => setTagsRaw(e.target.value)}
            placeholder="jungle, nature, indie game"
            className={inputCls}
          />
        </Field>

        {/* Commercial multiplier */}
        <Field
          label="Commercial license multiplier"
          htmlFor="pub-multiplier"
          hint="Buyers pay this × price for commercial use (default 3×)"
        >
          <select
            id="pub-multiplier"
            data-testid="publish-multiplier"
            value={multiplier}
            onChange={(e) => setMultiplier(e.target.value)}
            className={inputCls}
          >
            {["1.5", "2", "3", "5", "10"].map((m) => (
              <option key={m} value={m}>
                {m}×
              </option>
            ))}
          </select>
        </Field>

        {/* Error */}
        {error && (
          <p
            data-testid="publish-error"
            className="text-molten font-mono text-[11px] tracking-[0.04em]"
          >
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          data-testid="publish-submit"
          disabled={busy}
          style={!busy ? { color: "#1a0700" } : undefined}
          className={cn(
            "w-full py-3 rounded-pill font-mono text-[10.5px] tracking-[0.22em] uppercase font-semibold",
            "transition-all duration-fast ease-tune",
            busy
              ? "bg-elev-2/60 border border-glass-soft text-silver cursor-not-allowed"
              : "bg-molten hover:bg-molten-glow shadow-bloom",
          )}
        >
          {busy ? "Publishing…" : "Publish to marketplace"}
        </button>
      </form>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label
          htmlFor={htmlFor}
          className="font-mono text-[10px] tracking-[0.22em] uppercase text-silver"
        >
          {label}
        </label>
        {hint && (
          <span className="font-mono text-[9.5px] text-silver2 tracking-[0.04em]">{hint}</span>
        )}
      </div>
      {children}
    </div>
  );
}

const inputCls =
  "w-full bg-elev-2/40 border border-glass-soft rounded-md px-3 py-2.5 text-warm text-[14px] placeholder:text-silver2 focus:outline-none focus:border-glass transition-colors duration-fast ease-tune";
