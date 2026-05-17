import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HeroBand } from "./HeroBand";

const station = {
  id: "brooklyn_887",
  station_name: "Brooklyn 88.7 Night Cab",
  year_or_era: "2026",
  place: "Brooklyn / Manhattan",
  reality_type: "earth" as const,
  station_slogan: "Stay awake. The city's listening.",
  broadcast_format: "late-night urban FM",
};

describe("HeroBand", () => {
  it("renders title + slogan + over-line metadata", () => {
    render(<HeroBand station={station} />);
    expect(screen.getByTestId("hero-title")).toHaveTextContent("Brooklyn 88.7 Night Cab");
    expect(screen.getByTestId("hero-quote")).toHaveTextContent(
      /stay awake\. the city's listening/i,
    );
    expect(screen.getAllByText(/earth/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2026/).length).toBeGreaterThan(0);
  });

  it("renders Play world and Export world pack buttons", () => {
    render(<HeroBand station={station} />);
    expect(screen.getByTestId("hero-play")).toBeInTheDocument();
    expect(screen.getByTestId("hero-export")).toBeInTheDocument();
  });

  it("Play button invokes onPlay with id", async () => {
    const onPlay = vi.fn();
    render(<HeroBand station={station} onPlay={onPlay} />);
    await userEvent.click(screen.getByTestId("hero-play"));
    expect(onPlay).toHaveBeenCalledWith("brooklyn_887");
  });

  it("Export button invokes onExport with id", async () => {
    const onExport = vi.fn();
    render(<HeroBand station={station} onExport={onExport} />);
    await userEvent.click(screen.getByTestId("hero-export"));
    expect(onExport).toHaveBeenCalledWith("brooklyn_887");
  });

  it("renders the generated plate + waveform strip", () => {
    render(<HeroBand station={station} />);
    expect(screen.getByTestId("hero-plate")).toBeInTheDocument();
    expect(screen.getByTestId("hero-wave")).toBeInTheDocument();
  });
});
