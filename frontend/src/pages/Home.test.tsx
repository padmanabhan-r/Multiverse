import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Pack } from "@multiverse-fm/shared";
import { api } from "@/lib/api";
import { Home } from "./Home";

const samplePack = (over: Partial<Pack>): Pack => ({
  id: "p-x",
  creator_id: "u_curated",
  title: "Sample",
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
  duration_ms: 30000,
  sample_count: 5,
  plays: 0,
  purchases_count: 0,
  style_profile: {},
  published_at: "2026-05-17T00:00:00Z",
  ...over,
});

beforeEach(() => {
  Element.prototype.scrollBy = vi.fn();
  vi.spyOn(api, "listPacks");
});

afterEach(() => {
  vi.restoreAllMocks();
});

function listPacksSpy() {
  return vi.mocked(api.listPacks);
}

function renderHome() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Home (marketplace landing)", () => {
  it("renders pitch line + category ribbon", () => {
    listPacksSpy().mockResolvedValue([]);
    renderHome();
    expect(screen.getByTestId("home-hero")).toBeInTheDocument();
    expect(screen.getByTestId("home-hero-search")).toBeInTheDocument();
    expect(screen.getByTestId("category-ribbon")).toBeInTheDocument();
  });

  it("category ribbon links to each of the 6 categories", () => {
    listPacksSpy().mockResolvedValue([]);
    renderHome();
    for (const cat of [
      "sfx",
      "music",
      "voice_packs",
      "ambient",
      "radio_packs",
      "broadcast_packs",
    ] as const) {
      expect(screen.getByTestId(`category-${cat}`)).toHaveAttribute(
        "href",
        `/browse/${cat}`,
      );
    }
  });

  it("renders hero skeleton while featured pack loads", () => {
    listPacksSpy().mockReturnValue(new Promise(() => {})); // never resolves
    renderHome();
    expect(screen.getByTestId("marketplace-hero-skeleton")).toBeInTheDocument();
  });

  it("renders hero with featured pack once API resolves", async () => {
    listPacksSpy().mockResolvedValue([
      samplePack({ id: "feat", title: "Geosync drift", category: "music", price_cents: 2200 }),
    ]);
    renderHome();
    await waitFor(() =>
      expect(screen.getByTestId("marketplace-hero")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("marketplace-hero-title")).toHaveTextContent(
      "Geosync drift",
    );
    expect(screen.getByTestId("marketplace-hero-open")).toHaveAttribute(
      "href",
      "/p/feat",
    );
  });

  it("does NOT mention the Brooklyn 88.7 radio identity", async () => {
    listPacksSpy().mockResolvedValue([
      samplePack({ id: "anything", title: "Anything" }),
    ]);
    renderHome();
    await waitFor(() =>
      expect(screen.getByTestId("marketplace-hero")).toBeInTheDocument(),
    );
    expect(screen.queryByText(/brooklyn 88\.7/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/night cab/i)).not.toBeInTheDocument();
  });

  it("renders pitch headline as marketplace, not radio", () => {
    listPacksSpy().mockResolvedValue([]);
    renderHome();
    expect(screen.getByTestId("home-hero-headline")).toHaveTextContent(
      /production-ready audio/i,
    );
  });
});
