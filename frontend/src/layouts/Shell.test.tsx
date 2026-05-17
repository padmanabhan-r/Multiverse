import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useCart } from "@/stores/cartStore";
import { Shell } from "./Shell";

beforeEach(() => {
  useCart.setState({ items: [] });
  vi.spyOn(api, "myCredits").mockRejectedValue(new Error("401")); // default guest
});

afterEach(() => {
  vi.restoreAllMocks();
  useCart.setState({ items: [] });
});

function renderShell(
  props: Parameters<typeof Shell>[0] = {},
  path = "/browse",
) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<Shell {...props} />} />
          <Route path="/browse" element={<Shell {...props} />} />
          <Route path="/studio" element={<Shell {...props} />} />
          <Route path="/library" element={<Shell {...props} />} />
          <Route path="/creator" element={<Shell {...props} />} />
          <Route path="/pricing" element={<Shell {...props} />} />
          <Route path="/cart" element={<Shell {...props} />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Shell", () => {
  it("renders V3 chrome — topbar wordmark MULTIVERSE, topbar nav, mobile tabs, no left sidebar", () => {
    renderShell({ children: <p>main content</p> });
    expect(screen.getByTestId("shell")).toBeInTheDocument();
    expect(screen.getByTestId("topbar")).toHaveTextContent(/MULTIVERSE/);
    expect(screen.getByTestId("topbar")).not.toHaveTextContent(/MULTIVERSE FM/);
    expect(screen.getByTestId("topbar-nav")).toBeInTheDocument();
    expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
    expect(screen.getByTestId("main")).toHaveTextContent("main content");
    expect(screen.getByTestId("mobile-tabs")).toBeInTheDocument();
  });

  it("topbar nav has 5 V3 entries linking to canonical routes", () => {
    renderShell();
    const nav = screen.getByTestId("topbar-nav");
    const labels = ["Discover", "Studio", "Library", "Creator", "Pricing"];
    for (const label of labels) {
      expect(within(nav).getByText(label)).toBeInTheDocument();
    }
    expect(within(nav).getByTestId("nav-discover")).toHaveAttribute("href", "/browse");
    expect(within(nav).getByTestId("nav-studio")).toHaveAttribute("href", "/studio");
    expect(within(nav).getByTestId("nav-library")).toHaveAttribute("href", "/library");
    expect(within(nav).getByTestId("nav-creator")).toHaveAttribute("href", "/creator");
    expect(within(nav).getByTestId("nav-pricing")).toHaveAttribute("href", "/pricing");
  });

  it("Discover nav is active on /browse", () => {
    renderShell({}, "/browse");
    expect(screen.getByTestId("nav-discover").className).toMatch(/molten/);
  });

  it("Studio nav activates when route changes", async () => {
    renderShell();
    await userEvent.click(screen.getByTestId("nav-studio"));
    expect(screen.getByTestId("nav-studio").className).toMatch(/molten/);
  });

  it("guest topbar: cart always visible + sign-in + join-free buttons", () => {
    renderShell();
    expect(screen.getByTestId("topbar-cart")).toHaveAttribute("href", "/cart");
    expect(screen.getByTestId("topbar-signin")).toBeInTheDocument();
    expect(screen.getByTestId("topbar-join")).toBeInTheDocument();
    // New pack CTA removed — replaced by Join free for guests
    expect(screen.queryByTestId("topbar-new")).not.toBeInTheDocument();
  });

  it("topbar cart count badge shows when cart has items", () => {
    useCart.setState({
      items: [
        {
          pack_id: "p1",
          title: "x",
          category: "sfx",
          cover_art_url: null,
          unit_price_cents: 500,
          license_kind: "personal",
        },
      ],
    });
    renderShell();
    expect(screen.getByTestId("topbar-cart-count")).toHaveTextContent("1");
  });

  it("does NOT include the v2 LISTENER/STUDIO segmented toggle", () => {
    renderShell();
    expect(screen.queryByRole("tablist", { name: /mode/i })).not.toBeInTheDocument();
  });

  it("does NOT mount bottom player or right panel by default (lazy)", () => {
    renderShell();
    expect(screen.queryByTestId("bottom-player")).not.toBeInTheDocument();
    expect(screen.queryByTestId("right-panel")).not.toBeInTheDocument();
  });

  it("mounts bottom player slot when provided + hides mobile tabs", () => {
    renderShell({ bottomPlayer: <span data-testid="player-stub">player</span> });
    expect(screen.getByTestId("bottom-player")).toBeInTheDocument();
    expect(screen.getByTestId("player-stub")).toBeInTheDocument();
    expect(screen.queryByTestId("mobile-tabs")).not.toBeInTheDocument();
  });

  it("mounts right panel when provided", () => {
    renderShell({ rightPanel: <span>panel</span> });
    expect(screen.getByTestId("right-panel")).toHaveTextContent("panel");
  });

  it("mobile bottom tabs have 4 entries (Discover/Studio/Library/Creator)", () => {
    renderShell();
    const tabs = screen.getByTestId("mobile-tabs");
    expect(within(tabs).getByTestId("mobile-nav-discover")).toBeInTheDocument();
    expect(within(tabs).getByTestId("mobile-nav-studio")).toBeInTheDocument();
    expect(within(tabs).getByTestId("mobile-nav-library")).toBeInTheDocument();
    expect(within(tabs).getByTestId("mobile-nav-creator")).toBeInTheDocument();
    expect(within(tabs).queryByTestId("mobile-nav-pricing")).not.toBeInTheDocument();
  });
});
