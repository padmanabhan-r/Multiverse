import { useState } from "react";
import type { SampleKind } from "@multiverse-fm/shared";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";

interface Props {
  value: string;
  kind: SampleKind;
  onAccept: (next: string) => void;
}

export function PromptEnhanceButton({ value, kind, onAccept }: Props) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [enriched, setEnriched] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    if (!value.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const out = await api.enhancePrompt(value.trim(), kind);
      setEnriched(out.enriched);
      setSuggestions(out.suggestions);
      setOpen(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "enhance failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        data-testid="enhance-btn"
        disabled={busy || !value.trim()}
        onClick={run}
        title="Enhance with AI"
        className={cn(
          "inline-flex items-center gap-1 h-7 px-2 rounded-md",
          "bg-elev-2/60 border border-glass-soft text-silver",
          "hover:text-warm hover:border-glass disabled:opacity-50",
          "font-mono text-[10px] tracking-[0.18em] uppercase",
        )}
      >
        {busy ? "…" : "✦ Enhance"}
      </button>
      {open && (
        <div
          data-testid="enhance-popover"
          className="
            absolute z-20 mt-2 right-0 w-80 p-3 rounded-lg
            mvfm-glass border border-glass-soft text-[12px] text-warm space-y-2
          "
        >
          <div>
            <div className="font-mono text-silver2 text-[9px] tracking-[0.28em] uppercase mb-1">
              Enriched
            </div>
            <button
              type="button"
              data-testid="enhance-accept"
              onClick={() => {
                onAccept(enriched);
                setOpen(false);
              }}
              className="text-left text-warm hover:text-molten"
            >
              {enriched}
            </button>
          </div>
          {suggestions.length > 0 && (
            <div className="space-y-1 border-t border-glass-soft pt-2">
              <div className="font-mono text-silver2 text-[9px] tracking-[0.28em] uppercase">
                Suggestions
              </div>
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    onAccept(s);
                    setOpen(false);
                  }}
                  className="block text-left text-silver hover:text-warm text-[11px]"
                >
                  · {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {err && <div className="text-[10px] text-molten mt-1">{err}</div>}
    </div>
  );
}
