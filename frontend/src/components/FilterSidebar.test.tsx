import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PackListFilters } from "@multiverse-fm/shared";
import { FilterSidebar } from "./FilterSidebar";

function Controlled({ onChange }: { onChange: (v: PackListFilters) => void }) {
  const [filters, setFilters] = useState<PackListFilters>({});
  return (
    <FilterSidebar
      filters={filters}
      onChange={(v) => {
        setFilters(v);
        onChange(v);
      }}
    />
  );
}

describe("FilterSidebar", () => {
  it("renders Search / Category / Price / Sort sections", () => {
    render(<FilterSidebar filters={{}} onChange={vi.fn()} />);
    expect(screen.getByTestId("filter-q")).toBeInTheDocument();
    expect(screen.getByTestId("filter-cat-all")).toBeInTheDocument();
    expect(screen.getByTestId("filter-cat-sfx")).toBeInTheDocument();
    expect(screen.getByTestId("filter-price-any")).toBeInTheDocument();
    expect(screen.getByTestId("filter-sort-new")).toBeInTheDocument();
  });

  it("All categories is active when no category filter set", () => {
    render(<FilterSidebar filters={{}} onChange={vi.fn()} />);
    expect(screen.getByTestId("filter-cat-all")).toHaveAttribute(
      "data-active",
      "true",
    );
  });

  it("category click dispatches onChange with new category", async () => {
    const onChange = vi.fn();
    render(<FilterSidebar filters={{}} onChange={onChange} />);
    await userEvent.click(screen.getByTestId("filter-cat-music"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ category: "music" }));
  });

  it("all-categories click clears existing category", async () => {
    const onChange = vi.fn();
    render(
      <FilterSidebar filters={{ category: "music" }} onChange={onChange} />,
    );
    await userEvent.click(screen.getByTestId("filter-cat-all"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ category: undefined }));
  });

  it("price bucket click dispatches min/max", async () => {
    const onChange = vi.fn();
    render(<FilterSidebar filters={{}} onChange={onChange} />);
    await userEvent.click(screen.getByTestId("filter-price-10-20"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        price_min_cents: 1000,
        price_max_cents: 2000,
      }),
    );
  });

  it("sort radio dispatches new sort", async () => {
    const onChange = vi.fn();
    render(<FilterSidebar filters={{}} onChange={onChange} />);
    const sort = screen.getByTestId("filter-sort");
    await userEvent.click(within(sort).getByTestId("filter-sort-price_asc"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ sort: "price_asc" }),
    );
  });

  it("typing in search dispatches q each keystroke (controlled)", async () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    await userEvent.type(screen.getByTestId("filter-q"), "noir");
    const last = onChange.mock.calls.at(-1)?.[0];
    expect(last.q).toBe("noir");
  });
});
