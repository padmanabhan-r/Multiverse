import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Pack } from "@multiverse/shared";
import { PackTile } from "./PackTile";

const basePack: Pack = {
  id: "pack-sfx-rainy-noir",
  creator_id: "u_curated",
  creator_name: "Multiverse",
  title: "Rainy noir stings",
  description: "10 short stings",
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
  preview_url: null,
  duration_ms: 30000,
  sample_count: 10,
  plays: 0,
  purchases_count: 0,
  style_profile: {},
  published_at: "2026-05-17T00:00:00Z",
};

describe("PackTile", () => {
  it("renders title + price badge + category chip + sample count", () => {
    render(<PackTile pack={basePack} />);
    expect(screen.getByText("Rainy noir stings")).toBeInTheDocument();
    expect(screen.getByTestId("pack-tile-category")).toHaveTextContent("SFX");
    expect(screen.getByTestId("pack-tile-price")).toHaveTextContent("$5");
    expect(screen.getByTestId("pack-tile-meta")).toHaveTextContent(/10 sounds/);
  });

  it("price badge formats fractional dollars", () => {
    render(
      <PackTile pack={{ ...basePack, price_cents: 1299 }} />,
    );
    expect(screen.getByTestId("pack-tile-price")).toHaveTextContent("$12.99");
  });

  it("creator chip shows 'Multiverse' for the curated system user", () => {
    render(<PackTile pack={basePack} />);
    expect(screen.getByTestId("pack-tile-meta")).toHaveTextContent("Multiverse");
  });

  it("calls onSelect with id when body is clicked", async () => {
    const onSelect = vi.fn();
    render(<PackTile pack={basePack} onSelect={onSelect} />);
    await userEvent.click(
      screen.getByRole("button", { name: /open rainy noir stings/i }),
    );
    expect(onSelect).toHaveBeenCalledWith("pack-sfx-rainy-noir");
  });

  it("calls onPlay with id when play-ring clicked + stops propagation", async () => {
    const onSelect = vi.fn();
    const onPlay = vi.fn();
    render(
      <PackTile pack={basePack} onSelect={onSelect} onPlay={onPlay} />,
    );
    await userEvent.click(screen.getByTestId("pack-tile-play-ring"));
    expect(onPlay).toHaveBeenCalledWith("pack-sfx-rainy-noir");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("active state shows persistent dot", () => {
    render(<PackTile pack={basePack} active />);
    expect(screen.getByTestId(`pack-tile-${basePack.id}`)).toHaveAttribute(
      "data-active",
      "true",
    );
    expect(screen.getByTestId("pack-tile-active-dot")).toBeInTheDocument();
  });

  it("sm size omits meta strip (compact grid mode)", () => {
    render(<PackTile pack={basePack} size="sm" />);
    expect(screen.queryByTestId("pack-tile-meta")).not.toBeInTheDocument();
  });

  it("renders each category label", () => {
    const labels: Array<[Pack["category"], string]> = [
      ["sfx", "SFX"],
      ["music", "Music"],
      ["voice_packs", "Voice"],
      ["ambient", "Ambient"],
      ["radio_packs", "Radio"],
      ["broadcast_packs", "Broadcast"],
    ];
    for (const [cat, label] of labels) {
      const { unmount } = render(
        <PackTile pack={{ ...basePack, id: `t-${cat}`, category: cat }} />,
      );
      expect(screen.getByTestId("pack-tile-category")).toHaveTextContent(label);
      unmount();
    }
  });
});
