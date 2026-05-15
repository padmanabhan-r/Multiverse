import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders wordmark", () => {
    render(<App />);
    expect(screen.getByText(/multiverse fm/i)).toBeInTheDocument();
    expect(screen.getByText(/receiver online/i)).toBeInTheDocument();
  });
});
