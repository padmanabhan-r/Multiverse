import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { Pack } from "@multiverse-fm/shared";
import { useCart } from "@/stores/cartStore";
import { usePlayer } from "@/stores/playerStore";
import { PackDetailPanel } from "./PackDetailPanel";

const pack: Pack = {
  id: "pack-sfx-rainy-noir",
  creator_id: "u_curated",
  creator_name: "Multiverse",
  title: "Rainy noir stings",
  description: "10 short stings recorded under sodium lamps.",
  category: "sfx",
  tags: ["noir", "rain"],
  moods: ["noir"],
  price_cents: 500,
  credit_cost: 1,
  license_personal: true,
  license_commercial_multiplier: 3.0,
  status: "published",
  cover_art_url: null,
  hero_art_url: null,
  preview_url: "https://e/preview.mp3",
  duration_ms: 30000,
  sample_count: 10,
  plays: 0,
  purchases_count: 0,
  style_profile: {},
  published_at: "2026-05-17T00:00:00Z",
};

const reset = () => {
  useCart.setState({ items: [] });
  usePlayer.setState({
    currentStationId: null,
    isPlaying: false,
    progress: 0,
    selectedStationId: null,
    selectedPackId: pack.id,
  });
};

beforeEach(reset);
afterEach(reset);

function renderPanel() {
  return render(
    <MemoryRouter>
      <PackDetailPanel pack={pack} />
    </MemoryRouter>,
  );
}

describe("PackDetailPanel", () => {
  it("renders 2 tabs and defaults to Preview", () => {
    renderPanel();
    expect(screen.getByTestId("pack-tab-preview")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("pack-preview-tab")).toBeInTheDocument();
    expect(screen.queryByTestId("pack-tab-license")).not.toBeInTheDocument();
  });

  it("Preview tab shows title + sound count + duration + play CTA", () => {
    renderPanel();
    const panel = screen.getByTestId("pack-preview-tab");
    expect(within(panel).getByText("Rainy noir stings")).toBeInTheDocument();
    expect(within(panel).getByText(/10 sounds/)).toBeInTheDocument();
    expect(within(panel).getByText(/0:30/)).toBeInTheDocument();
    expect(within(panel).getByTestId("pack-preview-play")).toBeInTheDocument();
  });

  it("Preview tab shows Add to cart button with price", () => {
    renderPanel();
    const btn = screen.getByTestId("pack-add-to-cart");
    expect(btn).toHaveTextContent(/\$5/);
  });

  it("Details tab lists category, tags, creator", async () => {
    renderPanel();
    await userEvent.click(screen.getByTestId("pack-tab-details"));
    const panel = screen.getByTestId("pack-details-tab");
    expect(within(panel).getByText(/sound effects/i)).toBeInTheDocument();
    expect(within(panel).getByText("noir · rain")).toBeInTheDocument();
    expect(within(panel).getByText(/multiverse/i)).toBeInTheDocument();
  });

  it("Details tab labels SFX count as Sounds", async () => {
    renderPanel();
    await userEvent.click(screen.getByTestId("pack-tab-details"));
    const panel = screen.getByTestId("pack-details-tab");
    expect(within(panel).getByText("Sounds")).toBeInTheDocument();
  });

  it("Add to cart inserts into cartStore and flips CTA to View cart", async () => {
    renderPanel();
    await userEvent.click(screen.getByTestId("pack-add-to-cart"));
    expect(useCart.getState().items).toHaveLength(1);
    expect(screen.getByTestId("pack-open-cart")).toBeInTheDocument();
    expect(screen.queryByTestId("pack-add-to-cart")).not.toBeInTheDocument();
  });

  it("Remove from cart restores Add CTA", async () => {
    renderPanel();
    await userEvent.click(screen.getByTestId("pack-add-to-cart"));
    await userEvent.click(screen.getByTestId("pack-remove-from-cart"));
    expect(useCart.getState().items).toHaveLength(0);
    expect(screen.getByTestId("pack-add-to-cart")).toBeInTheDocument();
  });

  it("Close button clears selectedPackId in player store", async () => {
    renderPanel();
    await userEvent.click(screen.getByTestId("pack-panel-close"));
    expect(usePlayer.getState().selectedPackId).toBeNull();
  });
});
