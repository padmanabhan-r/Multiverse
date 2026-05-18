import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Pack as PackT } from "@multiverse/shared";
import { api } from "@/lib/api";
import { useCart } from "@/stores/cartStore";
import { Pack } from "./Pack";

const pack: PackT = {
  id: "pack-music-noir-rhodes",
  creator_id: "u_curated",
  creator_name: "Test Creator",
  title: "Noir Rhodes nights",
  description: "3 instrumental late-night Rhodes-led pieces.",
  category: "music",
  tags: ["noir", "jazz"],
  moods: ["noir"],
  price_cents: 2500,
  credit_cost: 4,
  license_personal: true,
  license_commercial_multiplier: 3.0,
  status: "published",
  cover_art_url: null,
  hero_art_url: null,
  preview_url: null,
  duration_ms: 540_000,
  sample_count: 3,
  plays: 0,
  purchases_count: 0,
  style_profile: {},
  published_at: "2026-05-17T00:00:00Z",
};

beforeEach(() => {
  useCart.setState({ items: [] });
  vi.spyOn(api, "getPack");
});

afterEach(() => {
  vi.restoreAllMocks();
  useCart.setState({ items: [] });
});

function getPackSpy() {
  return vi.mocked(api.getPack);
}

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/browse" element={<div data-testid="browse-stub" />} />
          <Route path="/cart" element={<div data-testid="cart-stub" />} />
          <Route path="/p/:packId" element={<Pack />} />
          <Route path="/u/:creatorId" element={<div data-testid="creator-stub" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Pack page", () => {
  it("renders skeleton while loading", () => {
    getPackSpy().mockReturnValueOnce(new Promise(() => {}));
    renderAt("/p/x");
    expect(screen.getByTestId("pack-skeleton")).toBeInTheDocument();
  });

  it("renders hero + title + schema once API resolves", async () => {
    getPackSpy().mockResolvedValueOnce(pack);
    renderAt("/p/pack-music-noir-rhodes");
    await waitFor(() =>
      expect(screen.getByTestId("pack-title")).toHaveTextContent("Noir Rhodes nights"),
    );
    expect(screen.getByTestId("pack-hero")).toBeInTheDocument();
    expect(screen.getByTestId("pack-schema")).toBeInTheDocument();
    expect(screen.getByTestId("pack-buy")).toBeInTheDocument();
  });

  it("sidebar shows credit price", async () => {
    getPackSpy().mockResolvedValueOnce(pack);
    renderAt("/p/pack-music-noir-rhodes");
    await waitFor(() => screen.getByTestId("pack-buy-total"));
    expect(screen.getByTestId("pack-buy-total")).toHaveTextContent("250");
  });

  it("Back link routes to /browse", async () => {
    getPackSpy().mockResolvedValueOnce(pack);
    renderAt("/p/pack-music-noir-rhodes");
    await waitFor(() => screen.getByTestId("pack-back"));
    await userEvent.click(screen.getByTestId("pack-back"));
    expect(screen.getByTestId("browse-stub")).toBeInTheDocument();
  });

  it("View creator routes to /u/:creatorId", async () => {
    getPackSpy().mockResolvedValueOnce(pack);
    renderAt("/p/pack-music-noir-rhodes");
    await waitFor(() => screen.getByTestId("pack-view-creator"));
    await userEvent.click(screen.getByTestId("pack-view-creator"));
    expect(screen.getByTestId("creator-stub")).toBeInTheDocument();
  });

  it("renders error state on API failure", async () => {
    getPackSpy().mockRejectedValueOnce(new Error("boom"));
    renderAt("/p/x");
    await waitFor(() => expect(screen.getByTestId("pack-error")).toBeInTheDocument());
  });
});
