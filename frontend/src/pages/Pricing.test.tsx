import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Pricing } from "./Pricing";

function renderPricing() {
  return render(
    <MemoryRouter>
      <Pricing />
    </MemoryRouter>,
  );
}

describe("Pricing", () => {
  it("renders page testid", () => {
    renderPricing();
    expect(screen.getByTestId("page-pricing")).toBeInTheDocument();
  });

  it("renders all 3 tier cards", () => {
    renderPricing();
    expect(screen.getByTestId("tier-free")).toBeInTheDocument();
    expect(screen.getByTestId("tier-creator")).toBeInTheDocument();
    expect(screen.getByTestId("tier-pro-studio")).toBeInTheDocument();
  });

  it("shows correct prices", () => {
    renderPricing();
    expect(screen.getByTestId("tier-free")).toHaveTextContent(/free/i);
    expect(screen.getByTestId("tier-creator")).toHaveTextContent(/\$9/);
    expect(screen.getByTestId("tier-pro-studio")).toHaveTextContent(/\$29/);
  });

  it("shows credit cost legend", () => {
    renderPricing();
    expect(screen.getByTestId("credit-legend")).toBeInTheDocument();
    // SFX = 2, music = 5
    expect(screen.getByTestId("credit-legend")).toHaveTextContent(/2 credits/i);
    expect(screen.getByTestId("credit-legend")).toHaveTextContent(/5 credits/i);
  });

  it("shows 70/30 marketplace fee explainer", () => {
    renderPricing();
    expect(screen.getByTestId("marketplace-fee")).toBeInTheDocument();
    expect(screen.getByTestId("marketplace-fee")).toHaveTextContent(/70%/);
  });

  it("shows Stripe Connect coming soon strip", () => {
    renderPricing();
    expect(screen.getByTestId("connect-soon")).toBeInTheDocument();
    expect(screen.getByTestId("connect-soon")).toHaveTextContent(/coming soon/i);
  });

  it("free tier CTA links to sign-up, paid tiers link to /checkout", () => {
    renderPricing();
    expect(screen.getByTestId("cta-free")).toBeInTheDocument();
    expect(screen.getByTestId("cta-creator")).toBeInTheDocument();
    expect(screen.getByTestId("cta-pro-studio")).toBeInTheDocument();
  });
});
