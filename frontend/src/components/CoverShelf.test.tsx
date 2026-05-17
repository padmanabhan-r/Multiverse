import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CoverShelf } from "./CoverShelf";

const items = ["a", "b", "c", "d", "e", "f"];

beforeEach(() => {
  // jsdom doesn't implement scrollBy; stub it
  Element.prototype.scrollBy = vi.fn();
});

describe("CoverShelf", () => {
  it("renders title + count + all items", () => {
    render(
      <CoverShelf
        title="Hero stations"
        countLabel="CURATED · 06"
        items={items}
        renderItem={(s) => <span data-testid={`item-${s}`}>{s}</span>}
      />,
    );
    expect(screen.getByText(/hero stations/i)).toBeInTheDocument();
    expect(screen.getByText(/CURATED · 06/)).toBeInTheDocument();
    for (const s of items) {
      expect(screen.getByTestId(`item-${s}`)).toBeInTheDocument();
    }
  });

  it("rail has scroll-snap mandatory class", () => {
    render(
      <CoverShelf
        title="X"
        items={items}
        renderItem={(s) => <span>{s}</span>}
      />,
    );
    const rail = screen.getByTestId("rail-x");
    expect(rail.className).toMatch(/snap-x/);
    expect(rail.className).toMatch(/snap-mandatory/);
    expect(rail.className).toMatch(/overflow-x-auto/);
  });

  it("arrow nav invokes scrollBy with positive + negative deltas", async () => {
    const spy = vi.spyOn(Element.prototype, "scrollBy");
    render(
      <CoverShelf
        title="X"
        items={items}
        scrollStep={218}
        renderItem={(s) => <span>{s}</span>}
      />,
    );
    const prev = screen.getByRole("button", { name: /scroll left/i });
    const next = screen.getByRole("button", { name: /scroll right/i });
    await userEvent.click(next);
    await userEvent.click(prev);
    expect(spy).toHaveBeenNthCalledWith(1, {
      left: 218,
      behavior: "smooth",
    });
    expect(spy).toHaveBeenNthCalledWith(2, {
      left: -218,
      behavior: "smooth",
    });
  });

  it("optional link label fires onLinkClick", async () => {
    const onLink = vi.fn();
    render(
      <CoverShelf
        title="X"
        linkLabel="See all"
        onLinkClick={onLink}
        items={items}
        renderItem={(s) => <span>{s}</span>}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /see all/i }));
    expect(onLink).toHaveBeenCalledOnce();
  });

  it("renders items inside a rail container", () => {
    render(
      <CoverShelf
        title="My shelf"
        items={items}
        renderItem={(s) => <span data-testid={`itm-${s}`}>{s}</span>}
      />,
    );
    const rail = screen.getByTestId("rail-my-shelf");
    for (const s of items) {
      expect(within(rail).getByTestId(`itm-${s}`)).toBeInTheDocument();
    }
  });
});
