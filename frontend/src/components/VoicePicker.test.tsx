import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { VoicePicker } from "./VoicePicker";
import { api } from "@/lib/api";

const listVoicesMock = vi.spyOn(api, "listVoices");
const listOwnedVoicesMock = vi.spyOn(api, "listOwnedVoices");

beforeEach(() => {
  listVoicesMock.mockReset();
  listOwnedVoicesMock.mockReset();
});
afterEach(() => {
  listVoicesMock.mockReset();
  listOwnedVoicesMock.mockReset();
});

function renderPicker(onSelect = vi.fn()) {
  return render(
    <MemoryRouter>
      <VoicePicker selectedVoiceId={null} onSelect={onSelect} locked={false} />
    </MemoryRouter>,
  );
}

describe("VoicePicker", () => {
  it("renders three tabs: mine / library / clone", async () => {
    listVoicesMock.mockResolvedValue([]);
    listOwnedVoicesMock.mockResolvedValue([]);
    renderPicker();
    await waitFor(() => {
      expect(screen.getByTestId("voice-tab-mine")).toBeInTheDocument();
      expect(screen.getByTestId("voice-tab-library")).toBeInTheDocument();
      expect(screen.getByTestId("voice-tab-clone")).toBeInTheDocument();
    });
  });

  it("populates My voices from /voices/mine", async () => {
    listVoicesMock.mockResolvedValue([]);
    listOwnedVoicesMock.mockResolvedValue([
      {
        id: "v1",
        creator_id: "u",
        creator_name: "Me",
        title: "Mine A",
        description: "",
        eleven_voice_id: "el_mine",
        preview_url: null,
        cover_art_url: null,
        price_credits: 80,
        status: "draft",
        tags: [],
        purchases_count: 0,
        created_at: null,
        published_at: null,
      },
    ]);
    const onSelect = vi.fn();
    renderPicker(onSelect);
    await waitFor(() =>
      expect(screen.getByTestId("voice-mine-el_mine")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId("voice-mine-el_mine"));
    expect(onSelect).toHaveBeenCalledWith("el_mine");
  });

  it("clone tab exposes a wizard link", async () => {
    listVoicesMock.mockResolvedValue([]);
    listOwnedVoicesMock.mockResolvedValue([]);
    renderPicker();
    await waitFor(() =>
      expect(screen.getByTestId("voice-tab-clone")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId("voice-tab-clone"));
    const link = await screen.findByTestId("voice-wizard-link");
    expect(link).toHaveAttribute("href", "/studio/voices/new");
  });
});
