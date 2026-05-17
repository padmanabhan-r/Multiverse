import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Station } from "@multiverse-fm/shared";
import { usePlayer } from "@/stores/playerStore";
import { RightPanel } from "./RightPanel";

const station: Station = {
  id: "brooklyn_887",
  station_name: "Brooklyn 88.7 Night Cab",
  reality_type: "earth",
  year_or_era: "2026",
  place: "Brooklyn / Manhattan",
  broadcast_format: "late-night urban FM",
  dj_persona: "Ray Castellano — third-shift DJ",
  language_register: "American English",
  music_blueprint: {},
  ad_economy: ["24-hr diners", "bodegas"],
  headline_style: "overnight precinct logs, transit delays",
  weather_style: "fog off the East River",
  ambient_palette: ["sirens", "subway rumble"],
  signal_texture: "warm FM",
  station_slogan: "Stay awake. The city's listening.",
  dj_voice_id: "",
  mastering_preset: "earth_now",
  tier_required: "free",
  card_art_url: null,
  hero_art_url: null,
};

const reset = () =>
  usePlayer.setState({
    currentStationId: null,
    isPlaying: false,
    progress: 0,
    selectedStationId: null,
  });

beforeEach(reset);
afterEach(reset);

describe("RightPanel", () => {
  it("renders 3 tabs and defaults to Now playing", () => {
    render(<RightPanel station={station} />);
    expect(screen.getByTestId("tab-now-playing")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("tab-world-data")).toBeInTheDocument();
    expect(screen.getByTestId("tab-export")).toBeInTheDocument();
    expect(screen.getByTestId("rp-now-playing")).toBeInTheDocument();
  });

  it("switches tabs on click", async () => {
    render(<RightPanel station={station} />);
    await userEvent.click(screen.getByTestId("tab-world-data"));
    expect(screen.getByTestId("rp-world-data")).toBeInTheDocument();
    expect(screen.queryByTestId("rp-now-playing")).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId("tab-export"));
    expect(screen.getByTestId("rp-export")).toBeInTheDocument();
  });

  it("Now playing tab shows DJ persona + segment timeline", () => {
    render(<RightPanel station={station} />);
    const panel = screen.getByTestId("rp-now-playing");
    expect(within(panel).getByText(/ray castellano/i)).toBeInTheDocument();
    expect(within(panel).getByTestId("rp-segments")).toBeInTheDocument();
    // 9 standard segments
    expect(within(panel).getAllByTestId(/^segment-/)).toHaveLength(9);
  });

  it("World data tab lists 12 schema fields", async () => {
    render(<RightPanel station={station} />);
    await userEvent.click(screen.getByTestId("tab-world-data"));
    const panel = screen.getByTestId("rp-world-data");
    expect(within(panel).getByText(/reality type/i)).toBeInTheDocument();
    expect(within(panel).getByText(/mastering preset/i)).toBeInTheDocument();
    expect(within(panel).queryByText(station.station_slogan)).not.toBeInTheDocument(); // slogan not in fields
    expect(within(panel).getByText(/late-night urban FM/i)).toBeInTheDocument();
  });

  it("Export tab shows World Pack contents + paywall for free user", async () => {
    render(<RightPanel station={station} userTier="free" />);
    await userEvent.click(screen.getByTestId("tab-export"));
    const panel = screen.getByTestId("rp-export");
    expect(within(panel).getByText("Broadcast block")).toBeInTheDocument();
    expect(within(panel).getByText(/manifest\.json/i)).toBeInTheDocument();
    expect(within(panel).getByTestId("rp-export-paywall")).toBeInTheDocument();
    expect(within(panel).queryByTestId("rp-export-download")).not.toBeInTheDocument();
  });

  it("Export tab shows download button for explorer tier on free station", async () => {
    render(<RightPanel station={station} userTier="explorer" />);
    await userEvent.click(screen.getByTestId("tab-export"));
    const panel = screen.getByTestId("rp-export");
    expect(within(panel).getByTestId("rp-export-download")).toBeInTheDocument();
    expect(within(panel).queryByTestId("rp-export-paywall")).not.toBeInTheDocument();
  });

  it("Close button dispatches closePanel via store", async () => {
    usePlayer.getState().select("brooklyn_887");
    render(<RightPanel station={station} />);
    await userEvent.click(screen.getByTestId("panel-close"));
    expect(usePlayer.getState().selectedStationId).toBeNull();
  });

  it("Now playing button invokes onPlay handler", async () => {
    const onPlay = vi.fn();
    render(<RightPanel station={station} onPlay={onPlay} />);
    await userEvent.click(screen.getByTestId("rp-play"));
    expect(onPlay).toHaveBeenCalledWith("brooklyn_887");
  });

  it("Ask the DJ button invokes onAskTheDJ handler", async () => {
    const onAsk = vi.fn();
    render(<RightPanel station={station} onAskTheDJ={onAsk} />);
    await userEvent.click(screen.getByTestId("rp-ask"));
    expect(onAsk).toHaveBeenCalledWith("brooklyn_887");
  });

  it("highlights active segment based on player progress", () => {
    usePlayer.setState({
      currentStationId: "brooklyn_887",
      isPlaying: true,
      progress: 0.5,
      selectedStationId: "brooklyn_887",
    });
    render(<RightPanel station={station} />);
    const segments = screen.getAllByTestId(/^segment-/);
    const active = segments.filter(
      (el) => el.getAttribute("data-active") === "true",
    );
    expect(active).toHaveLength(1);
  });
});
