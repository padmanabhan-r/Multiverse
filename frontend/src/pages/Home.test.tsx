import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Home } from "./Home";

beforeEach(() => {
  Element.prototype.scrollBy = vi.fn();
});

function renderHome() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Home />
    </MemoryRouter>,
  );
}

describe("Home page", () => {
  it("renders hero band with Brooklyn 88.7 station", () => {
    renderHome();
    expect(screen.getByTestId("hero-band")).toBeInTheDocument();
    expect(screen.getByTestId("hero-title")).toHaveTextContent("Brooklyn 88.7 Night Cab");
  });

  it("renders three cover shelves", () => {
    renderHome();
    expect(screen.getByTestId("shelf-hero-stations")).toBeInTheDocument();
    expect(screen.getByTestId("shelf-recently-created")).toBeInTheDocument();
    expect(screen.getByTestId("shelf-start-from-a-template")).toBeInTheDocument();
  });

  it("Hero stations shelf shows all 6 V2 station ids", () => {
    renderHome();
    const rail = screen.getByTestId("rail-hero-stations");
    for (const id of [
      "brooklyn_887",
      "city_fm_1986",
      "wartime_1940",
      "orbital_2089",
      "imperium_steamwire",
      "sunset_collapse_1086",
    ]) {
      expect(within(rail).getByTestId(`cover-tile-${id}`)).toBeInTheDocument();
    }
  });

  it("Recently created shelf uses creator chip", () => {
    renderHome();
    const rail = screen.getByTestId("rail-recently-created");
    expect(within(rail).getAllByText(/creator/i).length).toBeGreaterThan(0);
  });

  it("Start from a template shelf renders 5 templates", () => {
    renderHome();
    const rail = screen.getByTestId("rail-start-from-a-template");
    for (const id of [
      "tpl-cyberpunk",
      "tpl-detective",
      "tpl-orbital",
      "tpl-tavern",
      "tpl-wartime",
    ]) {
      expect(within(rail).getByTestId(`template-${id}`)).toBeInTheDocument();
    }
  });
});
