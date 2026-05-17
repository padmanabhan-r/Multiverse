import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CoverTile } from "./CoverTile";

const baseStation = {
  id: "brooklyn_887",
  station_name: "Brooklyn 88.7 Night Cab",
  year_or_era: "2026",
  place: "Brooklyn / Manhattan",
  broadcast_format: "late-night urban FM",
  tier_required: "free" as const,
};

describe("CoverTile", () => {
  it("renders station name + place + format in meta", () => {
    render(<CoverTile station={baseStation} />);
    const tile = screen.getByTestId("cover-tile-brooklyn_887");
    const meta = within(tile).getByTestId("tile-meta");
    expect(meta).toHaveTextContent("Brooklyn 88.7 Night Cab");
    expect(meta).toHaveTextContent("Brooklyn / Manhattan");
    expect(meta).toHaveTextContent("late-night urban FM");
  });

  it("renders generated cover plate + year badge", () => {
    render(<CoverTile station={baseStation} />);
    expect(screen.getByTestId("cover-plate")).toBeInTheDocument();
    expect(screen.getByText("2026")).toBeInTheDocument();
  });

  it("calls onSelect with id when tile body is clicked", async () => {
    const onSelect = vi.fn();
    render(<CoverTile station={baseStation} onSelect={onSelect} />);
    await userEvent.click(
      screen.getByRole("button", { name: /open brooklyn 88.7/i }),
    );
    expect(onSelect).toHaveBeenCalledWith("brooklyn_887");
  });

  it("calls onPlay with id when play-ring is clicked (and stops propagation)", async () => {
    const onSelect = vi.fn();
    const onPlay = vi.fn();
    render(
      <CoverTile station={baseStation} onSelect={onSelect} onPlay={onPlay} />,
    );
    await userEvent.click(screen.getByTestId("play-ring"));
    expect(onPlay).toHaveBeenCalledWith("brooklyn_887");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("active state mounts the persistent molten dot", () => {
    render(<CoverTile station={baseStation} active />);
    expect(screen.getByTestId("cover-tile-brooklyn_887")).toHaveAttribute(
      "data-active",
      "true",
    );
    expect(screen.getByTestId("active-dot")).toBeInTheDocument();
  });

  it("creator chip is shown only when creator=true", () => {
    const { rerender } = render(<CoverTile station={baseStation} />);
    expect(screen.queryByText(/creator/i)).not.toBeInTheDocument();
    rerender(<CoverTile station={baseStation} creator />);
    expect(screen.getByText(/creator/i)).toBeInTheDocument();
  });

  it("sm size has no meta strip (template-style)", () => {
    render(<CoverTile station={baseStation} size="sm" />);
    expect(screen.queryByTestId("tile-meta")).not.toBeInTheDocument();
  });

  it("data-size attribute reflects size prop", () => {
    render(<CoverTile station={baseStation} size="md" />);
    expect(screen.getByTestId("cover-tile-brooklyn_887")).toHaveAttribute(
      "data-size",
      "md",
    );
  });
});
