import { useState } from "react";
import { Link } from "react-router-dom";
import type { CartItem, PackCategory } from "@multiverse/shared";
import { cn } from "@/lib/cn";
import { plateFor } from "@/lib/stationArt";
import { api, ApiError } from "@/lib/api";
import { totalCents, useCart } from "@/stores/cartStore";

const CATEGORY_LABEL: Record<PackCategory, string> = {
  sfx: "SFX",
  music: "Music",
  voice_packs: "Voice",
  ambient: "Ambient",
  radio_packs: "Radio",
  broadcast_packs: "Broadcast",
};

export function Cart() {
  const items = useCart((s) => s.items);
  const remove = useCart((s) => s.remove);
  const clear = useCart((s) => s.clear);

  const [checkoutState, setCheckoutState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const onCheckout = async () => {
    if (items.length === 0 || checkoutState.kind === "loading") return;
    setCheckoutState({ kind: "loading" });
    try {
      const { url } = await api.checkoutCart(items);
      // Stripe redirect — full navigation, lose the SPA.
      window.location.href = url;
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      setCheckoutState({ kind: "error", message: msg });
    }
  };

  if (items.length === 0) return <EmptyCart />;

  const total = totalCents(items);

  return (
    <div data-testid="cart-page" className="space-y-6 sm:space-y-8">
      <header className="space-y-1">
        <div className="font-mono text-silver2 text-[10px] tracking-[0.32em] uppercase">
          Cart
        </div>
        <h1 className="font-display text-warm text-3xl sm:text-[40px] tracking-tight">
          Your cart.
        </h1>
        <p className="text-silver text-[14px] max-w-prose">
          Buy once. Download instantly. No subscription needed.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 lg:gap-8">
        <ul data-testid="cart-lines" className="flex flex-col gap-3">
          {items.map((item) => (
            <CartLine
              key={`${item.pack_id}:${item.license_kind}`}
              item={item}
              onRemove={() => remove(item.pack_id, item.license_kind)}
            />
          ))}
        </ul>

        <aside
          data-testid="cart-summary"
          className="
            self-start sticky top-[calc(var(--mvfm-topbar-h)+24px)]
            mvfm-glass mvfm-glass-top-edge rounded-xl p-4 sm:p-5
            space-y-4
          "
        >
          <div>
            <div className="font-mono text-silver2 text-[9px] tracking-[0.22em] uppercase">
              Summary
            </div>
            <div className="font-mono text-warm text-[15px] mt-1">
              {items.length} {items.length === 1 ? "item" : "items"}
            </div>
          </div>

          <div className="flex items-baseline justify-between border-t border-glass-soft pt-3">
            <span className="font-mono text-silver2 text-[9px] tracking-[0.22em] uppercase">
              Total
            </span>
            <span
              data-testid="cart-total"
              className="font-mono text-warm text-[22px] tracking-[-0.005em] font-semibold"
            >
              {formatPrice(total)}
            </span>
          </div>

          {checkoutState.kind === "error" && (
            <div
              data-testid="cart-error"
              className="
                p-3 rounded-md border border-glass-soft bg-elev-2/40
                font-mono text-[10.5px] text-silver leading-[1.5]
              "
            >
              <span className="text-molten uppercase tracking-[0.18em] text-[9px]">
                Checkout failed
              </span>
              <div className="mt-1.5 text-warm/85 break-all">
                {checkoutState.message}
              </div>
            </div>
          )}

          <button
            type="button"
            data-testid="cart-checkout"
            onClick={onCheckout}
            disabled={checkoutState.kind === "loading"}
            style={
              checkoutState.kind === "loading"
                ? undefined
                : {
                    color: "#1a0700",
                    background: "var(--mvfm-molten)",
                    boxShadow:
                      "0 0 0 1px rgba(255,106,31,0.7), 0 10px 30px -10px rgba(255,106,31,0.8), inset 0 1px 0 rgba(255,255,255,0.28)",
                  }
            }
            className={cn(
              "w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-md",
              "font-mono text-[10.5px] tracking-[0.18em] uppercase font-semibold",
              "transition-all duration-fast ease-tune",
              checkoutState.kind === "loading"
                ? "bg-elev-2/60 border border-glass-soft text-silver cursor-wait"
                : "hover:brightness-110",
            )}
          >
            {checkoutState.kind === "loading"
              ? "Redirecting to Stripe…"
              : `Pay ${formatPrice(total)} with Stripe`}
          </button>

          <button
            type="button"
            data-testid="cart-clear"
            onClick={clear}
            className="
              w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md
              text-silver hover:text-warm bg-elev-2/40 border border-glass-soft hover:border-glass
              font-mono text-[10px] tracking-[0.18em] uppercase
              transition-colors duration-fast ease-tune
            "
          >
            Clear cart
          </button>

          <p className="text-silver2 text-[10.5px] leading-[1.5]">
            Stripe Checkout in test mode. Use card{" "}
            <span className="font-mono text-warm">4242 4242 4242 4242</span>{" "}
            with any future date + CVC.
          </p>
        </aside>
      </div>
    </div>
  );
}

function CartLine({
  item,
  onRemove,
}: {
  item: CartItem;
  onRemove: () => void;
}) {
  const plate = plateFor(item.pack_id);
  return (
    <li
      data-testid={`cart-line-${item.pack_id}-${item.license_kind}`}
      className="flex items-center gap-3 p-3 rounded-md bg-elev-2/40 border border-glass-soft"
    >
      <div
        className="size-12 sm:size-14 rounded-md flex-shrink-0 relative overflow-hidden"
        style={{
          background: item.cover_art_url
            ? `center / cover no-repeat url('${item.cover_art_url}'), ${plate.background}`
            : plate.background,
        }}
      >
        <div className="absolute inset-0 mvfm-grain opacity-60 pointer-events-none" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-warm text-[13px] tracking-[0.01em] truncate">
            <Link to={`/p/${item.pack_id}`} className="hover:underline">
              {item.title}
            </Link>
          </span>
          <span className="font-mono text-silver2 text-[9px] tracking-[0.18em] uppercase">
            {CATEGORY_LABEL[item.category]}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="font-mono text-warm text-[14px] font-semibold tabular-nums">
          {formatPrice(item.unit_price_cents)}
        </span>
        <button
          type="button"
          aria-label={`Remove ${item.title} ${item.license_kind} from cart`}
          onClick={onRemove}
          className="
            size-7 rounded-md grid place-items-center
            text-silver2 hover:text-warm hover:bg-elev-2/60
            transition-colors duration-fast ease-tune
          "
        >
          <svg viewBox="0 0 12 12" fill="none" aria-hidden className="size-3">
            <path
              d="M3 3l6 6M9 3l-6 6"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </li>
  );
}

function EmptyCart() {
  return (
    <section
      data-testid="cart-empty"
      className="min-h-[60vh] grid place-items-center text-center px-6"
    >
      <div className="space-y-3 max-w-md">
        <div className="font-mono text-silver2 text-[10px] tracking-[0.32em] uppercase">
          Cart
        </div>
        <h1 className="font-display text-warm text-3xl sm:text-[40px] tracking-tight">
          Your cart is empty.
        </h1>
        <p className="text-silver text-[14px]">
          Browse the marketplace and add a pack from any pack detail page.
        </p>
        <Link
          to="/browse"
          className="
            inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md
            bg-elev-2/60 border border-glass-soft text-silver hover:text-warm hover:border-glass
            font-mono text-[10.5px] tracking-[0.18em] uppercase
            transition-colors duration-fast ease-tune
          "
        >
          Browse the marketplace
        </Link>
      </div>
    </section>
  );
}

function formatPrice(cents: number): string {
  return `${Math.round(cents / 10)} ⚡`;
}
