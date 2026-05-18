import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import type { Pack } from "@multiverse/shared";
import { ApiError, api } from "@/lib/api";

interface Props {
  pack: Pack;
  /** Optional CSS classes to size the button to its container. */
  className?: string;
}

export function BuyPackButton({ pack, className }: Props) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const price = pack.price_credits ?? Math.max(5, Math.round(pack.price_cents / 10));

  async function buy() {
    setBusy(true);
    setErr(null);
    try {
      await api.purchasePack(pack.id);
      qc.invalidateQueries({ queryKey: ["me", "credits"] });
      nav("/library");
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 402) {
          setErr("Not enough credits — top up first.");
          setTimeout(() => nav("/credits"), 1200);
        } else if (e.status === 409) {
          setErr("Already owned. Open your library.");
          setTimeout(() => nav("/library"), 1200);
        } else {
          setErr(e.message || "purchase failed");
        }
      } else {
        setErr(e instanceof Error ? e.message : "purchase failed");
      }
      setBusy(false);
    }
  }

  return (
    <div className={className ?? "inline-flex flex-col gap-1.5 items-start"}>
      <button
        type="button"
        data-testid={`buy-pack-${pack.id}`}
        onClick={buy}
        disabled={busy}
        style={{ color: "#1a0700" }}
        className="
          inline-flex items-center gap-2 px-4 py-2.5 rounded-md
          bg-molten font-mono text-[11px] tracking-[0.22em] uppercase
          font-semibold hover:bg-molten-glow shadow-bloom
          disabled:opacity-50
        "
      >
        {busy ? "Buying…" : `Buy for ${price} ⚡`}
      </button>
      {err && <div className="text-molten text-[11px]">{err}</div>}
    </div>
  );
}
