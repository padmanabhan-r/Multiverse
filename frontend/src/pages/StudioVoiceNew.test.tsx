import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { StudioVoiceNew } from "./StudioVoiceNew";
import { api, type CreatedVoice } from "@/lib/api";

const designPreviewsMock = vi.spyOn(api, "designPreviews");
const designSaveMock = vi.spyOn(api, "designSave");
const cloneInstantMock = vi.spyOn(api, "cloneInstant");
const clonePvcMock = vi.spyOn(api, "clonePvc");
const getCloneJobMock = vi.spyOn(api, "getCloneJob");

const FAKE_AUDIO = btoa("audio");

const CREATED_VOICE: CreatedVoice = {
  id: "v_test",
  creator_id: "u_test",
  eleven_voice_id: "el_perm",
  title: "Sylph",
  description: "",
  preview_url: null,
  cover_art_url: null,
  price_credits: 80,
  status: "draft",
  clone_kind: "design",
  training_status: "ready",
  is_private: true,
  requires_verification: false,
};

beforeEach(() => {
  designPreviewsMock.mockReset();
  designSaveMock.mockReset();
  cloneInstantMock.mockReset();
  clonePvcMock.mockReset();
  getCloneJobMock.mockReset();
  sessionStorage.clear();
});

afterEach(() => {
  designPreviewsMock.mockReset();
  designSaveMock.mockReset();
  cloneInstantMock.mockReset();
  clonePvcMock.mockReset();
  getCloneJobMock.mockReset();
  sessionStorage.clear();
});

function renderWizard() {
  return render(
    <MemoryRouter initialEntries={["/studio/voices/new"]}>
      <Routes>
        <Route path="/studio/voices/new" element={<StudioVoiceNew />} />
        <Route path="/creator" element={<div data-testid="creator-page" />} />
        <Route
          path="/v/:voiceId"
          element={<div data-testid="voice-detail" />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("StudioVoiceNew", () => {
  it("renders the three method cards", () => {
    renderWizard();
    expect(screen.getByTestId("method-design")).toBeInTheDocument();
    expect(screen.getByTestId("method-ivc")).toBeInTheDocument();
    expect(screen.getByTestId("method-pvc")).toBeInTheDocument();
  });

  it("design flow → previews → publish private → navigates to creator", async () => {
    designPreviewsMock.mockResolvedValue({
      previews: [
        { generated_voice_id: "g0", audio_base_64: FAKE_AUDIO, media_type: "audio/mpeg" },
        { generated_voice_id: "g1", audio_base_64: FAKE_AUDIO, media_type: "audio/mpeg" },
        { generated_voice_id: "g2", audio_base_64: FAKE_AUDIO, media_type: "audio/mpeg" },
      ],
    });
    designSaveMock.mockResolvedValue(CREATED_VOICE);

    renderWizard();
    fireEvent.click(screen.getByTestId("method-design"));

    fireEvent.change(screen.getByTestId("design-name"), {
      target: { value: "Sylph" },
    });
    fireEvent.change(screen.getByTestId("design-prompt"), {
      target: { value: "warm forest spirit" },
    });
    fireEvent.click(screen.getByTestId("design-submit"));

    await waitFor(() =>
      expect(designPreviewsMock).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: "warm forest spirit", name: "Sylph" }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByTestId("preview-picker")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByTestId("preview-1"));
    fireEvent.click(screen.getByTestId("preview-confirm"));
    fireEvent.click(screen.getByTestId("fork-private"));

    await waitFor(() =>
      expect(designSaveMock).toHaveBeenCalledWith(
        expect.objectContaining({
          generated_voice_id: "g1",
          publish_kind: "private",
        }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByTestId("creator-page")).toBeInTheDocument(),
    );
  });

  it("marketplace_draft path navigates to /v/:id", async () => {
    designPreviewsMock.mockResolvedValue({
      previews: [
        { generated_voice_id: "g0", audio_base_64: FAKE_AUDIO, media_type: "audio/mpeg" },
        { generated_voice_id: "g1", audio_base_64: FAKE_AUDIO, media_type: "audio/mpeg" },
        { generated_voice_id: "g2", audio_base_64: FAKE_AUDIO, media_type: "audio/mpeg" },
      ],
    });
    designSaveMock.mockResolvedValue(CREATED_VOICE);

    renderWizard();
    fireEvent.click(screen.getByTestId("method-design"));
    fireEvent.change(screen.getByTestId("design-name"), {
      target: { value: "Sylph" },
    });
    fireEvent.change(screen.getByTestId("design-prompt"), {
      target: { value: "forest" },
    });
    fireEvent.click(screen.getByTestId("design-submit"));
    await waitFor(() =>
      expect(screen.getByTestId("preview-picker")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId("preview-confirm"));
    fireEvent.click(screen.getByTestId("fork-marketplace"));

    await waitFor(() =>
      expect(designSaveMock).toHaveBeenCalledWith(
        expect.objectContaining({ publish_kind: "marketplace_draft" }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByTestId("voice-detail")).toBeInTheDocument(),
    );
  });

  it("shows error + does not advance when preview fetch fails", async () => {
    designPreviewsMock.mockRejectedValue(new Error("boom"));

    renderWizard();
    fireEvent.click(screen.getByTestId("method-design"));
    fireEvent.change(screen.getByTestId("design-name"), {
      target: { value: "X" },
    });
    fireEvent.change(screen.getByTestId("design-prompt"), {
      target: { value: "y" },
    });
    fireEvent.click(screen.getByTestId("design-submit"));

    await waitFor(() =>
      expect(screen.getByTestId("voice-new-error")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("preview-picker")).toBeNull();
  });

  it("PVC flow posts FormData, lands on job status pane", async () => {
    clonePvcMock.mockResolvedValue({
      id: "job_abc",
      voice_id: "v_pvc",
      status: "queued",
      poll_attempts: 0,
      credits_spent: 50,
      refunded: false,
      error_message: null,
      created_at: null,
      completed_at: null,
    });
    getCloneJobMock.mockResolvedValue({
      id: "job_abc",
      voice_id: "v_pvc",
      status: "queued",
      poll_attempts: 1,
      credits_spent: 50,
      refunded: false,
      error_message: null,
      created_at: null,
      completed_at: null,
    });

    renderWizard();
    fireEvent.click(screen.getByTestId("method-pvc"));

    fireEvent.change(screen.getByTestId("pvc-name"), {
      target: { value: "ProMe" },
    });
    const f1 = new File([new Uint8Array(100_000)], "a.mp3", { type: "audio/mpeg" });
    const f2 = new File([new Uint8Array(100_000)], "b.mp3", { type: "audio/mpeg" });
    const input = screen.getByTestId("audio-dropzone-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [f1, f2] } });

    await waitFor(() =>
      expect(screen.getByTestId("pvc-file-status")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId("pvc-continue"));
    fireEvent.click(screen.getByTestId("fork-private"));

    await waitFor(() => expect(clonePvcMock).toHaveBeenCalled());
    const form = clonePvcMock.mock.calls[0][0] as FormData;
    expect(form.get("name")).toBe("ProMe");
    expect(form.get("language")).toBe("en");
    expect(form.getAll("files")).toHaveLength(2);

    await waitFor(() =>
      expect(screen.getByTestId("clone-job-status")).toBeInTheDocument(),
    );
  });

  it("IVC upload flow posts FormData and navigates", async () => {
    cloneInstantMock.mockResolvedValue({ ...CREATED_VOICE, clone_kind: "ivc" });

    renderWizard();
    fireEvent.click(screen.getByTestId("method-ivc"));

    fireEvent.change(screen.getByTestId("ivc-name"), {
      target: { value: "MyVoice" },
    });
    fireEvent.click(screen.getByTestId("ivc-mode-upload"));

    const file = new File([new Uint8Array(50000)], "sample.mp3", {
      type: "audio/mpeg",
    });
    const input = screen.getByTestId("audio-dropzone-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(screen.getByTestId("ivc-file-status")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId("ivc-continue"));
    fireEvent.click(screen.getByTestId("fork-private"));

    await waitFor(() => expect(cloneInstantMock).toHaveBeenCalled());
    const form = cloneInstantMock.mock.calls[0][0] as FormData;
    expect(form.get("name")).toBe("MyVoice");
    expect(form.get("publish_kind")).toBe("private");
    expect(form.getAll("files")).toHaveLength(1);
    await waitFor(() =>
      expect(screen.getByTestId("creator-page")).toBeInTheDocument(),
    );
  });

  it("IVC dropzone rejects non-audio file", () => {
    renderWizard();
    fireEvent.click(screen.getByTestId("method-ivc"));
    fireEvent.click(screen.getByTestId("ivc-mode-upload"));

    const txt = new File([new Uint8Array(100)], "notes.txt", {
      type: "text/plain",
    });
    const input = screen.getByTestId("audio-dropzone-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [txt] } });

    expect(screen.getByTestId("audio-dropzone-error")).toBeInTheDocument();
  });
});
