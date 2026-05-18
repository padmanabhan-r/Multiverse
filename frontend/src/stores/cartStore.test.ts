import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Pack } from "@multiverse/shared";
import { lineCount, totalCents, useCart } from "./cartStore";

function pk(over: Partial<Pack> = {}): Pack {
  return {
    id: "p1",
    creator_id: "u_curated",
    creator_name: "Test Creator",
    title: "Sample pack",
    description: "",
    category: "sfx",
    tags: [],
    moods: [],
    price_cents: 500,
    credit_cost: 1,
    license_personal: true,
    license_commercial_multiplier: 3.0,
    status: "published",
    cover_art_url: null,
    hero_art_url: null,
    preview_url: null,
    duration_ms: 0,
    sample_count: 1,
    plays: 0,
    purchases_count: 0,
    style_profile: {},
    published_at: null,
    ...over,
  };
}

beforeEach(() => useCart.setState({ items: [] }));
afterEach(() => useCart.setState({ items: [] }));

describe("cartStore", () => {
  it("starts empty", () => {
    expect(useCart.getState().items).toEqual([]);
  });

  it("add() inserts an item with personal price by default", () => {
    useCart.getState().add(pk(), "personal");
    const items = useCart.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].pack_id).toBe("p1");
    expect(items[0].license_kind).toBe("personal");
    expect(items[0].unit_price_cents).toBe(500);
  });

  it("add() applies commercial multiplier", () => {
    useCart.getState().add(pk({ price_cents: 1000, license_commercial_multiplier: 3 }), "commercial");
    expect(useCart.getState().items[0].unit_price_cents).toBe(3000);
  });

  it("add() does NOT duplicate the same (pack, license)", () => {
    useCart.getState().add(pk(), "personal");
    useCart.getState().add(pk(), "personal");
    expect(useCart.getState().items).toHaveLength(1);
  });

  it("add() allows personal + commercial of the same pack as 2 lines", () => {
    const p = pk({ price_cents: 1000, license_commercial_multiplier: 3 });
    useCart.getState().add(p, "personal");
    useCart.getState().add(p, "commercial");
    const items = useCart.getState().items;
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.license_kind).sort()).toEqual([
      "commercial",
      "personal",
    ]);
  });

  it("remove() drops only the matching line", () => {
    const p = pk({ price_cents: 1000, license_commercial_multiplier: 3 });
    useCart.getState().add(p, "personal");
    useCart.getState().add(p, "commercial");
    useCart.getState().remove("p1", "personal");
    const items = useCart.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].license_kind).toBe("commercial");
  });

  it("clear() empties cart", () => {
    useCart.getState().add(pk(), "personal");
    useCart.getState().clear();
    expect(useCart.getState().items).toEqual([]);
  });

  it("itemFor() finds a specific (pack, license) line", () => {
    useCart.getState().add(pk(), "personal");
    expect(useCart.getState().itemFor("p1", "personal")).toBeDefined();
    expect(useCart.getState().itemFor("p1", "commercial")).toBeUndefined();
  });

  it("totalCents() + lineCount() helpers", () => {
    useCart.getState().add(pk({ id: "a", price_cents: 500 }), "personal");
    useCart.getState().add(pk({ id: "b", price_cents: 1500 }), "personal");
    const items = useCart.getState().items;
    expect(lineCount(items)).toBe(2);
    expect(totalCents(items)).toBe(2000);
  });
});
