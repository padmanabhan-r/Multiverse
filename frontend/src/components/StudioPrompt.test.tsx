import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StudioPrompt } from "./StudioPrompt";

describe("StudioPrompt", () => {
  it("renders textarea + mood grid + Lock CTA", () => {
    render(<StudioPrompt />);
    expect(screen.getByTestId("studio-prompt-textarea")).toBeInTheDocument();
    const grid = screen.getByTestId("studio-mood-grid");
    expect(within(grid).getAllByRole("button")).toHaveLength(12);
    expect(screen.getByTestId("studio-lock")).toBeInTheDocument();
  });

  it("Lock CTA disabled when prompt empty + no moods selected", () => {
    render(<StudioPrompt />);
    expect(screen.getByTestId("studio-lock")).toBeDisabled();
  });

  it("typing in textarea enables Lock CTA", async () => {
    render(<StudioPrompt />);
    await userEvent.type(
      screen.getByTestId("studio-prompt-textarea"),
      "rain falls upward",
    );
    expect(screen.getByTestId("studio-lock")).not.toBeDisabled();
  });

  it("selecting a mood enables Lock CTA + onChange fires", async () => {
    const onChange = vi.fn();
    render(<StudioPrompt onChange={onChange} />);
    await userEvent.click(screen.getByTestId("mood-chip-noir"));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ moods: ["noir"] }),
    );
    expect(screen.getByTestId("studio-lock")).not.toBeDisabled();
  });

  it("submitting fires onSubmit with the current value", async () => {
    const onSubmit = vi.fn();
    render(<StudioPrompt onSubmit={onSubmit} />);
    await userEvent.type(
      screen.getByTestId("studio-prompt-textarea"),
      "a foggy noir city",
    );
    await userEvent.click(screen.getByTestId("mood-chip-noir"));
    await userEvent.click(screen.getByTestId("studio-lock"));
    expect(onSubmit).toHaveBeenCalledOnce();
    const v = onSubmit.mock.calls[0][0];
    expect(v.prompt).toMatch(/foggy noir city/);
    expect(v.moods).toContain("noir");
    expect(v.duration).toBe(240);
    expect(v.profile).toBe("radio_show");
  });

  it("duration segmented control updates value", async () => {
    const onChange = vi.fn();
    render(<StudioPrompt onChange={onChange} />);
    await userEvent.click(screen.getByTestId("studio-duration-60"));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ duration: 60 }),
    );
  });

  it("profile segmented control updates value", async () => {
    const onChange = vi.fn();
    render(<StudioPrompt onChange={onChange} />);
    await userEvent.click(screen.getByTestId("studio-profile-trailer"));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ profile: "trailer" }),
    );
  });

  it("character counter decrements as user types", async () => {
    render(<StudioPrompt />);
    expect(screen.getByTestId("studio-prompt-counter")).toHaveTextContent(/240/);
    await userEvent.type(
      screen.getByTestId("studio-prompt-textarea"),
      "abc",
    );
    expect(screen.getByTestId("studio-prompt-counter")).toHaveTextContent(/237/);
  });
});
