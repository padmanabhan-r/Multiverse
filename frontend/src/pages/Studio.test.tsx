import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Studio } from "./Studio";
import { api } from "@/lib/api";

const listMyPacksMock = vi.spyOn(api, "listMyPacks");

beforeEach(() => listMyPacksMock.mockReset());
afterEach(() => listMyPacksMock.mockReset());

function renderStudio() {
  return render(
    <MemoryRouter>
      <Studio />
    </MemoryRouter>,
  );
}

describe("Studio landing", () => {
  it("renders header + CTAs", async () => {
    listMyPacksMock.mockResolvedValue([]);
    renderStudio();
    expect(screen.getByTestId("studio-page")).toBeInTheDocument();
    expect(screen.getByTestId("cta-new-pack")).toHaveAttribute(
      "href",
      "/studio/new",
    );
    expect(screen.getByTestId("cta-new-bundle")).toHaveAttribute(
      "href",
      "/studio/bundle/new",
    );
  });

  it("lists drafts + published from /packs/mine", async () => {
    listMyPacksMock.mockResolvedValue([
      {
        id: "d1",
        creator_id: "u",
        creator_name: "Test Creator",
        title: "Draft One",
        description: "",
        category: "sfx",
        tags: [],
        moods: [],
        price_cents: 200,
        credit_cost: 1,
        license_personal: true,
        license_commercial_multiplier: 3,
        status: "draft",
        cover_art_url: null,
        hero_art_url: null,
        preview_url: null,
        duration_ms: 0,
        sample_count: 0,
        plays: 0,
        purchases_count: 0,
        style_profile: {},
        published_at: null,
      },
      {
        id: "p1",
        creator_id: "u",
        creator_name: "Test Creator",
        title: "Published One",
        description: "",
        category: "sfx",
        tags: [],
        moods: [],
        price_cents: 200,
        credit_cost: 1,
        license_personal: true,
        license_commercial_multiplier: 3,
        status: "published",
        cover_art_url: null,
        hero_art_url: null,
        preview_url: null,
        duration_ms: 1000,
        sample_count: 1,
        plays: 0,
        purchases_count: 0,
        style_profile: {},
        published_at: null,
      },
    ]);
    renderStudio();
    await screen.findByTestId("pack-link-d1");
    expect(screen.getByTestId("pack-link-d1")).toHaveAttribute(
      "href",
      "/studio/draft/d1",
    );
    expect(screen.getByTestId("pack-link-p1")).toHaveAttribute(
      "href",
      "/p/p1",
    );
  });
});
