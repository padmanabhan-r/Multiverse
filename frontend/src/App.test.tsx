import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";

beforeEach(() => {
  Element.prototype.scrollBy = vi.fn();
});

describe("App", () => {
  it("mounts the Shell + Home page with the hero station", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("shell")).toBeInTheDocument();
    expect(screen.getByTestId("home-page")).toBeInTheDocument();
    expect(screen.getByTestId("hero-title")).toHaveTextContent(
      /brooklyn 88\.7 night cab/i,
    );
  });

  it("mounts the World page at /w/:stationId", () => {
    render(
      <MemoryRouter initialEntries={["/w/sunset_collapse_1086"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("world-page")).toBeInTheDocument();
    expect(screen.getByTestId("world-title")).toHaveTextContent(
      /sunset collapse 108\.6/i,
    );
  });
});
