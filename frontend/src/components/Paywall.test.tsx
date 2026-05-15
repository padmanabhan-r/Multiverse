import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Paywall } from "./Paywall";

describe("Paywall", () => {
  it("renders children when tier suffices", () => {
    render(
      <Paywall currentTier="architect" requires="explorer">
        <span>hello world</span>
      </Paywall>,
    );
    expect(screen.getByText("hello world")).toBeInTheDocument();
    expect(screen.queryByTestId("paywall-block")).not.toBeInTheDocument();
  });

  it("blocks free user from architect content and exposes upgrade CTA", async () => {
    const onUpgrade = vi.fn();
    render(
      <Paywall currentTier="free" requires="architect" onUpgrade={onUpgrade}>
        <span>secret</span>
      </Paywall>,
    );
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
    const btn = screen.getByRole("button", { name: /upgrade to architect/i });
    await userEvent.click(btn);
    expect(onUpgrade).toHaveBeenCalledWith("architect");
  });

  it("renders custom fallback when provided", () => {
    render(
      <Paywall
        currentTier="free"
        requires="explorer"
        fallback={<span data-testid="custom">nope</span>}
      >
        <span>x</span>
      </Paywall>,
    );
    expect(screen.getByTestId("custom")).toBeInTheDocument();
  });
});
