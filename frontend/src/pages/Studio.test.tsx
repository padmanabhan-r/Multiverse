import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { usePlayer } from "@/stores/playerStore";
import { Studio } from "./Studio";

const reset = () =>
  usePlayer.setState({
    currentStationId: null,
    isPlaying: false,
    progress: 0,
    selectedStationId: null,
  });

beforeEach(reset);
afterEach(reset);

function renderStudio() {
  return render(
    <MemoryRouter initialEntries={["/studio"]}>
      <Studio />
    </MemoryRouter>,
  );
}

describe("Studio page", () => {
  it("renders the prompt form on idle", () => {
    renderStudio();
    expect(screen.getByTestId("studio-page")).toBeInTheDocument();
    expect(screen.getByTestId("studio-prompt")).toBeInTheDocument();
    expect(screen.queryByTestId("studio-loader")).not.toBeInTheDocument();
    expect(screen.queryByTestId("studio-reveal")).not.toBeInTheDocument();
  });

  it("submitting the prompt transitions to generating state", async () => {
    renderStudio();
    await userEvent.type(
      screen.getByTestId("studio-prompt-textarea"),
      "rain falls upward",
    );
    await userEvent.click(screen.getByTestId("studio-lock"));
    expect(screen.getByTestId("studio-loader")).toBeInTheDocument();
    expect(screen.getByTestId("studio-stages")).toBeInTheDocument();
    expect(screen.queryByTestId("studio-prompt")).not.toBeInTheDocument();
  });

  it("Cancel returns to idle prompt", async () => {
    renderStudio();
    await userEvent.type(
      screen.getByTestId("studio-prompt-textarea"),
      "noir city",
    );
    await userEvent.click(screen.getByTestId("studio-lock"));
    expect(screen.getByTestId("studio-loader")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("studio-cancel"));
    expect(screen.getByTestId("studio-prompt")).toBeInTheDocument();
    expect(screen.queryByTestId("studio-loader")).not.toBeInTheDocument();
  });

  // NOTE: reveal-after-completion is not unit-tested here because the local
  // stub uses Date.now() to drive elapsed-time. Real backend job lands in S8
  // (Architect Mode WebSocket); will get a proper test alongside.
});
