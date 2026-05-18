import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Pack } from "@multiverse/shared";
import { StudioPublish } from "./StudioPublish";

const STUB_PACK: Pack = {
  id: "test-sfx-pack",
  creator_id: "u_test",
  creator_name: "Test Creator",
  title: "Jungle SFX Pack",
  description: "Dense jungle soundscape",
  category: "sfx",
  tags: ["jungle", "nature"],
  moods: ["atmospheric"],
  price_cents: 700,
  credit_cost: 1,
  license_personal: true,
  license_commercial_multiplier: 3,
  status: "published",
  cover_art_url: null,
  hero_art_url: null,
  preview_url: null,
  duration_ms: 0,
  sample_count: 5,
  plays: 0,
  purchases_count: 0,
  style_profile: {},
  published_at: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  vi.spyOn(api, "createDraft").mockResolvedValue(STUB_PACK);
  vi.spyOn(api, "publishPack").mockResolvedValue(STUB_PACK);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderPublish() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/studio/publish"]}>
        <Routes>
          <Route path="/studio/publish" element={<StudioPublish />} />
          <Route path="/p/:packId" element={<div data-testid="pack-page">Pack page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("StudioPublish", () => {
  it("renders the publish form", () => {
    renderPublish();
    expect(screen.getByTestId("studio-publish-form")).toBeInTheDocument();
    expect(screen.getByTestId("publish-title")).toBeInTheDocument();
    expect(screen.getByTestId("publish-category")).toBeInTheDocument();
    expect(screen.getByTestId("publish-description")).toBeInTheDocument();
    expect(screen.getByTestId("publish-price")).toBeInTheDocument();
    expect(screen.getByTestId("publish-tags")).toBeInTheDocument();
    expect(screen.getByTestId("publish-submit")).toBeInTheDocument();
  });

  it("submit calls createDraft then publishPack then redirects", async () => {
    renderPublish();
    await userEvent.clear(screen.getByTestId("publish-title"));
    await userEvent.type(screen.getByTestId("publish-title"), "Jungle SFX Pack");
    await userEvent.type(screen.getByTestId("publish-description"), "Dense jungle sounds");
    await userEvent.click(screen.getByTestId("publish-submit"));
    await waitFor(() => {
      expect(api.createDraft).toHaveBeenCalledOnce();
      expect(api.publishPack).toHaveBeenCalledWith("test-sfx-pack");
    });
    await waitFor(() => {
      expect(screen.getByTestId("pack-page")).toBeInTheDocument();
    });
  });

  it("shows validation error when title is empty", async () => {
    renderPublish();
    await userEvent.click(screen.getByTestId("publish-submit"));
    expect(await screen.findByTestId("publish-error")).toBeInTheDocument();
    expect(api.createDraft).not.toHaveBeenCalled();
  });

  it("submit button shows loading state while publishing", async () => {
    // Never resolves during this test
    vi.mocked(api.createDraft).mockReturnValue(new Promise(() => {}));
    renderPublish();
    await userEvent.type(screen.getByTestId("publish-title"), "My Pack");
    await userEvent.click(screen.getByTestId("publish-submit"));
    expect(screen.getByTestId("publish-submit")).toBeDisabled();
  });
});
