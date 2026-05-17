import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Shell } from "./Shell";

function renderShell(props: Parameters<typeof Shell>[0] = {}) {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<Shell {...props} />} />
        <Route path="/studio" element={<Shell {...props} />} />
        <Route path="/library" element={<Shell {...props} />} />
        <Route path="/creator" element={<Shell {...props} />} />
        <Route path="/pricing" element={<Shell {...props} />} />
        <Route path="/cart" element={<Shell {...props} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Shell", () => {
  it("renders V3 chrome — topbar wordmark MULTIVERSE, sidebar, mobile-tabs", () => {
    renderShell({ children: <p>main content</p> });
    expect(screen.getByTestId("shell")).toBeInTheDocument();
    expect(screen.getByTestId("topbar")).toHaveTextContent(/MULTIVERSE/);
    expect(screen.getByTestId("topbar")).not.toHaveTextContent(/MULTIVERSE FM/);
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("main")).toHaveTextContent("main content");
    expect(screen.getByTestId("mobile-tabs")).toBeInTheDocument();
  });

  it("sidebar has 5 V3 nav rows linking to canonical routes", () => {
    renderShell();
    const sidebar = screen.getByTestId("sidebar");
    const labels = ["Discover", "Studio", "Library", "Creator", "Pricing"];
    for (const label of labels) {
      expect(within(sidebar).getByText(label)).toBeInTheDocument();
    }
    expect(within(sidebar).getByTestId("nav-discover")).toHaveAttribute("href", "/");
    expect(within(sidebar).getByTestId("nav-studio")).toHaveAttribute("href", "/studio");
    expect(within(sidebar).getByTestId("nav-library")).toHaveAttribute("href", "/library");
    expect(within(sidebar).getByTestId("nav-creator")).toHaveAttribute("href", "/creator");
    expect(within(sidebar).getByTestId("nav-pricing")).toHaveAttribute("href", "/pricing");
  });

  it("Discover nav is active on /", () => {
    renderShell();
    expect(screen.getByTestId("nav-discover").className).toMatch(/molten/);
  });

  it("Studio nav activates when route changes", async () => {
    renderShell();
    await userEvent.click(screen.getByTestId("nav-studio"));
    expect(screen.getByTestId("nav-studio").className).toMatch(/molten/);
  });

  it("topbar has cart link, credit pill and New pack CTA", () => {
    renderShell();
    expect(screen.getByTestId("topbar-cart")).toHaveAttribute("href", "/cart");
    expect(screen.getByTestId("topbar-credits")).toBeInTheDocument();
    expect(screen.getByTestId("topbar-new")).toHaveAttribute("href", "/studio");
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
