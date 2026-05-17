import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { usePlayer } from "@/stores/playerStore";
import { World } from "./World";

const reset = () =>
  usePlayer.setState({
    currentStationId: null,
    isPlaying: false,
    progress: 0,
    selectedStationId: null,
  });

beforeEach(reset);
afterEach(reset);

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<div data-testid="home-stub" />} />
        <Route path="/w/:stationId" element={<World />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("World page", () => {
  it("renders station heading + slogan + schema for known id", () => {
    renderAt("/w/brooklyn_887");
    expect(screen.getByTestId("world-title")).toHaveTextContent(
      "Brooklyn 88.7 Night Cab",
    );
    expect(screen.getByTestId("world-slogan")).toHaveTextContent(
      /stay awake\. the city's listening/i,
    );
    expect(screen.getByTestId("world-schema")).toBeInTheDocument();
    expect(screen.getAllByTestId(/^schema-field-/)).toHaveLength(12);
  });

  it("renders hero plate + grain + vignette layers", () => {
    renderAt("/w/sunset_collapse_1086");
    expect(screen.getByTestId("world-hero")).toBeInTheDocument();
    expect(screen.getByTestId("world-plate")).toBeInTheDocument();
    expect(screen.getByTestId("world-overlay")).toBeInTheDocument();
  });

  it("Play CTA dispatches play() with stationId", async () => {
    renderAt("/w/brooklyn_887");
    await userEvent.click(screen.getByTestId("world-play"));
    expect(usePlayer.getState().currentStationId).toBe("brooklyn_887");
    expect(usePlayer.getState().isPlaying).toBe(true);
  });

  it("Ask the DJ CTA opens the right panel via select()", async () => {
    renderAt("/w/brooklyn_887");
    await userEvent.click(screen.getByTestId("world-ask"));
    expect(usePlayer.getState().selectedStationId).toBe("brooklyn_887");
  });

  it("Export CTA opens the right panel via select()", async () => {
    cleanup();
    reset();
    renderAt("/w/brooklyn_887");
    await userEvent.click(screen.getByTestId("world-export"));
    expect(usePlayer.getState().selectedStationId).toBe("brooklyn_887");
  });

  it("Back link routes to /", async () => {
    renderAt("/w/brooklyn_887");
    await userEvent.click(screen.getByTestId("world-back"));
    expect(screen.getByTestId("home-stub")).toBeInTheDocument();
  });

  it("Not-found state for unknown id", () => {
    renderAt("/w/does-not-exist");
    expect(screen.getByTestId("world-not-found")).toBeInTheDocument();
    expect(screen.queryByTestId("world-title")).not.toBeInTheDocument();
  });

  it("Overlay shows 'Now on air' when this station is playing", () => {
    usePlayer.getState().play("brooklyn_887");
    renderAt("/w/brooklyn_887");
    const overlay = screen.getByTestId("world-overlay");
    expect(within(overlay).getByText(/now on air/i)).toBeInTheDocument();
  });
});
