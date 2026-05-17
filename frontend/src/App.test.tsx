import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { App } from "./App";

beforeEach(() => {
  Element.prototype.scrollBy = vi.fn();
  vi.spyOn(api, "listPacks").mockResolvedValue([]);
  vi.spyOn(api, "getPack").mockResolvedValue(
    // never called when selectedPackId is null; provide a benign fallback anyway
    null as unknown as Awaited<ReturnType<typeof api.getPack>>,
  );
});

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("App", () => {
  it("mounts the Shell + marketplace Home page", () => {
    renderAt("/");
    expect(screen.getByTestId("shell")).toBeInTheDocument();
    expect(screen.getByTestId("home-page")).toBeInTheDocument();
    expect(screen.getByTestId("category-ribbon")).toBeInTheDocument();
  });

  it("mounts the Browse page at /browse", () => {
    renderAt("/browse");
    expect(screen.getByTestId("browse-page")).toBeInTheDocument();
  });

  it("mounts the World page at /w/:stationId", () => {
    renderAt("/w/sunset_collapse_1086");
    expect(screen.getByTestId("world-page")).toBeInTheDocument();
    expect(screen.getByTestId("world-title")).toHaveTextContent(
      /sunset collapse 108\.6/i,
    );
  });

  it("renders Stub page at /library", () => {
    renderAt("/library");
    expect(screen.getByTestId("page-library")).toBeInTheDocument();
  });

  it("mounts real Creator dashboard at /creator", () => {
    vi.spyOn(api, "creatorMe").mockResolvedValue({
      creator_id: "u",
      display_name: null,
      bio: null,
      avatar_url: null,
      draft_count: 0,
      published_count: 0,
      bundle_count: 0,
      sales_count_30d: 0,
      sales_cents_30d: 0,
    });
    vi.spyOn(api, "listMyPacks").mockResolvedValue([]);
    vi.spyOn(api, "listMyBundles").mockResolvedValue([]);
    vi.spyOn(api, "creatorSales").mockResolvedValue([]);
    renderAt("/creator");
    expect(screen.getByTestId("creator-loading")).toBeInTheDocument();
  });

  it("renders Pricing page at /pricing", () => {
    renderAt("/pricing");
    expect(screen.getByTestId("page-pricing")).toBeInTheDocument();
    expect(screen.getByTestId("tier-free")).toBeInTheDocument();
    expect(screen.getByTestId("tier-creator")).toBeInTheDocument();
    expect(screen.getByTestId("tier-pro-studio")).toBeInTheDocument();
  });

  it("mounts the Cart page at /cart", () => {
    renderAt("/cart");
    // Empty cart by default — cart-empty is the rendered state.
    expect(screen.getByTestId("cart-empty")).toBeInTheDocument();
  });
});
