import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Pack } from "@multiverse-fm/shared";
import { api } from "@/lib/api";
import { Browse } from "./Browse";

function mkPack(over: Partial<Pack> = {}): Pack {
  return {
    id: "pack-x",
    creator_id: "u_curated",
    creator_name: "Test Creator",
    title: "Pack X",
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
    duration_ms: 10000,
    sample_count: 5,
    plays: 0,
    purchases_count: 0,
    style_profile: {},
    published_at: "2026-05-17T00:00:00Z",
    ...over,
  };
}

beforeEach(() => {
  vi.spyOn(api, "listPacks");
});

afterEach(() => {
  vi.restoreAllMocks();
});

function listPacksSpy() {
  return vi.mocked(api.listPacks);
}

function renderAt(path: string) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/browse" element={<Browse />} />
          <Route path="/browse/:category" element={<Browse />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Browse page", () => {
  it("renders skeleton while loading", () => {
    listPacksSpy().mockReturnValueOnce(new Promise(() => {})); // never resolves
    renderAt("/browse");
    expect(screen.getByTestId("browse-skeleton")).toBeInTheDocument();
  });

  it("renders the grid with packs once API resolves", async () => {
    listPacksSpy().mockResolvedValueOnce([
      mkPack({ id: "a", title: "Alpha" }),
      mkPack({ id: "b", title: "Bravo", category: "music" }),
    ]);
    renderAt("/browse");
    await waitFor(() =>
      expect(screen.getByTestId("pack-grid")).toBeInTheDocument(),
    );
    const grid = screen.getByTestId("pack-grid");
    expect(within(grid).getByText("Alpha")).toBeInTheDocument();
    expect(within(grid).getByText("Bravo")).toBeInTheDocument();
  });

  it("uses URL category param as default filter", async () => {
    listPacksSpy().mockResolvedValue([]);
    renderAt("/browse/music");
    await waitFor(() =>
      expect(listPacksSpy()).toHaveBeenCalledWith(
        expect.objectContaining({ category: "music" }),
      ),
    );
    expect(screen.getByTestId("browse-heading")).toHaveTextContent(/music/i);
  });

  it("renders empty state when API returns no packs", async () => {
    listPacksSpy().mockResolvedValueOnce([]);
    renderAt("/browse");
    await waitFor(() =>
      expect(screen.getByTestId("browse-empty")).toBeInTheDocument(),
    );
  });

  it("renders error state on API failure", async () => {
    listPacksSpy().mockRejectedValueOnce(new Error("boom"));
    renderAt("/browse");
    await waitFor(() =>
      expect(screen.getByTestId("browse-error")).toBeInTheDocument(),
    );
  });

  it("changing category filter re-fires query with new category", async () => {
    listPacksSpy().mockResolvedValue([]);
    renderAt("/browse");
    await waitFor(() => expect(listPacksSpy()).toHaveBeenCalled());
    listPacksSpy().mockClear();
    listPacksSpy().mockResolvedValue([]);
    await userEvent.click(screen.getByTestId("filter-cat-ambient"));
    await waitFor(() =>
      expect(listPacksSpy()).toHaveBeenCalledWith(
        expect.objectContaining({ category: "ambient" }),
      ),
    );
  });
});
