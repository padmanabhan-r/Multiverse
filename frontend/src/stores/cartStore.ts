import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, LicenseKind, Pack } from "@multiverse/shared";

export interface CartState {
  items: CartItem[];
  add: (pack: Pack, licenseKind: LicenseKind) => void;
  remove: (packId: string, licenseKind: LicenseKind) => void;
  clear: () => void;
  itemFor: (packId: string, licenseKind: LicenseKind) => CartItem | undefined;
}

function unitPriceFor(pack: Pack, licenseKind: LicenseKind): number {
  // Canonical price = credits (matches every product display).
  // Stored as cents-equivalent (credits * 10) so formatPrice (cents / 10) yields credits.
  const baseCredits = pack.price_credits ?? Math.round(pack.price_cents / 10);
  const m = licenseKind === "commercial" ? (pack.license_commercial_multiplier || 1) : 1;
  return Math.round(baseCredits * 10 * m);
}

export function totalCents(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.unit_price_cents, 0);
}

export function lineCount(items: CartItem[]): number {
  return items.length;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (pack, licenseKind) =>
        set((s) => {
          // No duplicates for the same (pack, license) — toggle adds, not stacks.
          const idx = s.items.findIndex(
            (i) => i.pack_id === pack.id && i.license_kind === licenseKind,
          );
          if (idx >= 0) return s;
          const next: CartItem = {
            pack_id: pack.id,
            title: pack.title,
            category: pack.category,
            cover_art_url: pack.cover_art_url,
            unit_price_cents: unitPriceFor(pack, licenseKind),
            license_kind: licenseKind,
          };
          return { items: [...s.items, next] };
        }),
      remove: (packId, licenseKind) =>
        set((s) => ({
          items: s.items.filter(
            (i) => !(i.pack_id === packId && i.license_kind === licenseKind),
          ),
        })),
      clear: () => set({ items: [] }),
      itemFor: (packId, licenseKind) =>
        get().items.find(
          (i) => i.pack_id === packId && i.license_kind === licenseKind,
        ),
    }),
    { name: "multiverse-cart-v2" },
  ),
);
