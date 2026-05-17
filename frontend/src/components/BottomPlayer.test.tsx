import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePlayer } from "@/stores/playerStore";
import { BottomPlayer } from "./BottomPlayer";

const station = {
  id: "brooklyn_887",
  station_name: "Brooklyn 88.7 Night Cab",
  year_or_era: "2026",
  dj_persona: "Ray Castellano",
  place: "Brooklyn",
};

const reset = () =>
  usePlayer.setState({ currentStationId: null, isPlaying: false, progress: 0 });

beforeEach(reset);
afterEach(reset);

describe("BottomPlayer", () => {
  it("renders station + DJ + cover + dial", () => {
    usePlayer.getState().play("brooklyn_887");
    render(<BottomPlayer station={station} />);
    expect(screen.getByText("Brooklyn 88.7 Night Cab")).toBeInTheDocument();
    expect(screen.getByText("Ray Castellano")).toBeInTheDocument();
    expect(screen.getByTestId("player-cover")).toBeInTheDocument();
    expect(screen.getByTestId("player-dial")).toBeInTheDocument();
  });

  it("toggle button reflects isPlaying state via aria-label", async () => {
    usePlayer.getState().play("brooklyn_887");
    render(<BottomPlayer station={station} />);
    const btn = screen.getByTestId("player-toggle");
    expect(btn).toHaveAttribute("aria-label", "Pause");
    await userEvent.click(btn);
    expect(usePlayer.getState().isPlaying).toBe(false);
    expect(screen.getByTestId("player-toggle")).toHaveAttribute(
      "aria-label",
      "Play",
    );
  });

  it("dial active state matches isPlaying", () => {
    usePlayer.getState().play("brooklyn_887");
    const { rerender } = render(<BottomPlayer station={station} />);
    expect(screen.getByTestId("player-dial")).toHaveAttribute("data-active", "true");
    usePlayer.getState().pause();
    rerender(<BottomPlayer station={station} />);
    expect(screen.getByTestId("player-dial")).toHaveAttribute("data-active", "false");
  });

  it("Ask the DJ button invokes onAskTheDJ with id", async () => {
    const fn = vi.fn();
    usePlayer.getState().play("brooklyn_887");
    render(<BottomPlayer station={station} onAskTheDJ={fn} />);
    await userEvent.click(screen.getByTestId("player-ask-dj"));
    expect(fn).toHaveBeenCalledWith("brooklyn_887");
  });

  it("Export button invokes onExport with id", async () => {
    const fn = vi.fn();
    usePlayer.getState().play("brooklyn_887");
    render(<BottomPlayer station={station} onExport={fn} />);
    await userEvent.click(screen.getByTestId("player-export"));
    expect(fn).toHaveBeenCalledWith("brooklyn_887");
  });

  it("Close button stops + clears player state", async () => {
    usePlayer.getState().play("brooklyn_887");
    render(<BottomPlayer station={station} />);
    await userEvent.click(screen.getByTestId("player-close"));
    const s = usePlayer.getState();
    expect(s.currentStationId).toBeNull();
    expect(s.isPlaying).toBe(false);
  });
});
