import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Pack } from "@multiverse-fm/shared";
import { LicensePicker } from "./LicensePicker";

const pack: Pack = {
  id: "p",
  creator_id: "u",
  title: "T",
  description: "",
  category: "sfx",
  tags: [],
  moods: [],
  price_cents: 1000,
  credit_cost: 2,
  license_personal: true,
  license_commercial_multiplier: 3.0,
  status: "published",
  cover_art_url: null,
  hero_art_url: null,
  preview_url: null,
  duration_ms: 0,
  sample_count: 1,
  plays: 0,
  purchases_count: 0,
  style_profile: {},
  published_at: null,
};

describe("LicensePicker", () => {
  it("renders both options with correct prices ($10 personal, $30 commercial)", () => {
    render(<LicensePicker pack={pack} value="personal" onChange={() => {}} />);
    expect(screen.getByTestId("license-personal")).toHaveTextContent("$10");
    expect(screen.getByTestId("license-commercial")).toHaveTextContent("$30");
  });

  it("active state reflects value prop", () => {
    const { rerender } = render(
      <LicensePicker pack={pack} value="personal" onChange={() => {}} />,
    );
    expect(screen.getByTestId("license-personal")).toHaveAttribute(
      "data-active",
      "true",
    );
    expect(screen.getByTestId("license-commercial")).toHaveAttribute(
      "data-active",
      "false",
    );
    rerender(
      <LicensePicker pack={pack} value="commercial" onChange={() => {}} />,
    );
    expect(screen.getByTestId("license-commercial")).toHaveAttribute(
      "data-active",
      "true",
    );
  });

  it("clicking an option fires onChange with kind", async () => {
    const fn = vi.fn();
    render(<LicensePicker pack={pack} value="personal" onChange={fn} />);
    await userEvent.click(screen.getByTestId("license-commercial"));
    expect(fn).toHaveBeenCalledWith("commercial");
  });
});
