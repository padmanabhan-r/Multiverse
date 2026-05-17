import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { CreditBadge } from "./CreditBadge";

function renderBadge(props: Parameters<typeof CreditBadge>[0]) {
  return render(
    <MemoryRouter>
      <CreditBadge {...props} />
    </MemoryRouter>,
  );
}

describe("CreditBadge", () => {
  it("free user shows 'Free' state pointing to /pricing", () => {
    renderBadge({ balance: 0, tierGrant: 0 });
    const badge = screen.getByTestId("credit-badge");
    expect(badge).toHaveAttribute("href", "/pricing");
    expect(badge).toHaveAttribute("data-state", "free");
    expect(badge).toHaveTextContent("Free");
  });

  it("subscribed user shows balance count", () => {
    renderBadge({ balance: 17, tierGrant: 20 });
    expect(screen.getByTestId("credit-badge")).toHaveAttribute("data-state", "ok");
    expect(screen.getByTestId("credit-badge-balance")).toHaveTextContent("17");
  });

  it("low balance triggers molten 'low' visual state", () => {
    renderBadge({ balance: 1, tierGrant: 20 });
    expect(screen.getByTestId("credit-badge")).toHaveAttribute("data-state", "low");
  });
});
