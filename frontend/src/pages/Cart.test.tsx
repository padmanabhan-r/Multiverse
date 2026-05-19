import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Pack } from "@multiverse/shared";
import { api, ApiError } from "@/lib/api";
import { useCart } from "@/stores/cartStore";
import { Cart } from "./Cart";

const samplePack: Pack = {
  id: "p-1",
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
};

beforeEach(() => {
  useCart.setState({ items: [] });
  vi.spyOn(api, "checkoutCart");
});

afterEach(() => {
  vi.restoreAllMocks();
  useCart.setState({ items: [] });
});

function checkoutSpy() {
  return vi.mocked(api.checkoutCart);
}

function renderCart() {
  return render(
    <MemoryRouter initialEntries={["/cart"]}>
      <Routes>
        <Route path="/cart" element={<Cart />} />
        <Route path="/browse" element={<div data-testid="browse-stub" />} />
        <Route path="/p/:packId" element={<div data-testid="pack-stub" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Cart page", () => {
  it("renders empty state when cart is empty", () => {
    renderCart();
    expect(screen.getByTestId("cart-empty")).toBeInTheDocument();
  });

  it("renders all lines + total when cart has items", () => {
    useCart.getState().add(samplePack, "personal");
    useCart
      .getState()
      .add({ ...samplePack, id: "p-2", title: "Another", price_cents: 1500 }, "personal");
    renderCart();
    const lines = screen.getByTestId("cart-lines");
    expect(within(lines).getByText("Sample pack")).toBeInTheDocument();
    expect(within(lines).getByText("Another")).toBeInTheDocument();
    expect(screen.getByTestId("cart-total")).toHaveTextContent("200 ⚡");
  });

  it("Remove button drops the matching line", async () => {
    useCart.getState().add(samplePack, "personal");
    renderCart();
    await userEvent.click(
      screen.getByRole("button", { name: /remove sample pack/i }),
    );
    expect(useCart.getState().items).toHaveLength(0);
  });

  it("Clear button empties cart", async () => {
    useCart.getState().add(samplePack, "personal");
    useCart.getState().add(samplePack, "commercial");
    renderCart();
    await userEvent.click(screen.getByTestId("cart-clear"));
    expect(useCart.getState().items).toHaveLength(0);
  });

  it("Checkout button calls API + redirects via window.location", async () => {
    useCart.getState().add(samplePack, "personal");
    checkoutSpy().mockResolvedValueOnce({ url: "https://checkout.stripe.test/abc" });
    const originalLocation = window.location;
    const redirected: { href?: string } = {};
    Object.defineProperty(window, "location", {
      writable: true,
      value: {
        get href() {
          return redirected.href ?? "";
        },
        set href(v: string) {
          redirected.href = v;
        },
      },
    });
    renderCart();
    await userEvent.click(screen.getByTestId("cart-checkout"));
    await waitFor(() =>
      expect(redirected.href).toBe("https://checkout.stripe.test/abc"),
    );
    Object.defineProperty(window, "location", {
      writable: true,
      value: originalLocation,
    });
    expect(checkoutSpy()).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          pack_id: "p-1",
          license_kind: "personal",
        }),
      ]),
    );
  });

  it("Checkout shows error state on API failure", async () => {
    useCart.getState().add(samplePack, "personal");
    checkoutSpy().mockRejectedValueOnce(new ApiError(400, "cart invalid"));
    renderCart();
    await userEvent.click(screen.getByTestId("cart-checkout"));
    await waitFor(() => expect(screen.getByTestId("cart-error")).toBeInTheDocument());
    expect(screen.getByTestId("cart-error")).toHaveTextContent(/cart invalid/i);
  });

  it("empty cart's Browse link routes to /browse", async () => {
    renderCart();
    await userEvent.click(screen.getByRole("link", { name: /browse the marketplace/i }));
    expect(screen.getByTestId("browse-stub")).toBeInTheDocument();
  });
});
