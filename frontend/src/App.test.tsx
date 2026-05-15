import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders placeholder wordmark while Claude Design is being authored", () => {
    render(<App />);
    expect(screen.getByText(/multiverse fm/i)).toBeInTheDocument();
    expect(screen.getByText(/receiver online/i)).toBeInTheDocument();
  });
});
