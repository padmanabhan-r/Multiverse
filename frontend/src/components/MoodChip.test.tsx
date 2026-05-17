import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MoodChip, STUDIO_MOODS } from "./MoodChip";

describe("MoodChip", () => {
  it("renders label + thumbnail", () => {
    render(<MoodChip chip={STUDIO_MOODS[0]} />);
    expect(screen.getByText("Cyberpunk")).toBeInTheDocument();
    expect(screen.getByTestId("mood-chip-thumb")).toBeInTheDocument();
  });

  it("clicking the chip invokes onToggle with id", async () => {
    const fn = vi.fn();
    render(<MoodChip chip={STUDIO_MOODS[1]} onToggle={fn} />);
    await userEvent.click(screen.getByTestId("mood-chip-noir"));
    expect(fn).toHaveBeenCalledWith("noir");
  });

  it("selected=true shows tick + molten label + aria-pressed=true", () => {
    render(<MoodChip chip={STUDIO_MOODS[1]} selected />);
    const chip = screen.getByTestId("mood-chip-noir");
    expect(chip).toHaveAttribute("data-selected", "true");
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("mood-chip-tick")).toBeInTheDocument();
  });

  it("selected=false has no tick", () => {
    render(<MoodChip chip={STUDIO_MOODS[1]} />);
    expect(screen.queryByTestId("mood-chip-tick")).not.toBeInTheDocument();
  });

  it("STUDIO_MOODS has exactly 12 distinct ids", () => {
    expect(STUDIO_MOODS).toHaveLength(12);
    const ids = new Set(STUDIO_MOODS.map((m) => m.id));
    expect(ids.size).toBe(12);
  });
});
