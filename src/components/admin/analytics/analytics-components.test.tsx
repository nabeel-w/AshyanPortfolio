import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BarList, Funnel, SegmentedBar } from "./panels";
import { StatTile } from "./stat-tile";

describe("StatTile", () => {
  it("shows value, a signed delta with an arrow, and a labelled sparkline", () => {
    render(<StatTile label="Visitors" value="1,284" current={150} previous={100} trend={[1, 2, 3]} />);
    expect(screen.getByText("1,284")).toBeInTheDocument();
    expect(screen.getByText("+50%")).toBeInTheDocument();
    expect(screen.getByText("▲")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Visitors per day" })).toBeInTheDocument();
  });

  it("flags a drop in red when up is good, and marks a new metric", () => {
    const { rerender } = render(<StatTile label="Plays" value="5" current={5} previous={10} trend={[]} />);
    expect(screen.getByText("−50%").closest("span")).toHaveClass("text-red-bright");
    rerender(<StatTile label="Plays" value="5" current={5} previous={0} trend={[]} />);
    expect(screen.getByText("new")).toBeInTheDocument();
  });
});

describe("BarList", () => {
  it("ranks items with value + share, highlights one, and folds the tail into Other", () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ key: `k${i}`, label: `Item ${i}`, value: 10 - i, highlight: i === 1 }));
    render(<BarList items={items} limit={3} />);
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(4);
    expect(rows[3]).toHaveTextContent("Other (7)");
    expect(rows[3]).toHaveTextContent("28"); // 7+6+…+1
    expect(rows[1].querySelector(".bg-red-bright")).not.toBeNull();
    expect(rows[0].querySelector(".bg-red-bright")).toBeNull();
  });

  it("shows an empty state", () => {
    render(<BarList items={[]} />);
    expect(screen.getByText(/No data/)).toBeInTheDocument();
  });
});

describe("Funnel / SegmentedBar", () => {
  it("prints each step as a share of plays and the drop from the step before", () => {
    render(<Funnel steps={[{ label: "Play", value: 10 }, { label: "50%", value: 5 }]} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("50%", { selector: "span.w-36" })).toBeInTheDocument();
    expect(screen.getByText("−50% vs previous step")).toBeInTheDocument();
  });

  it("names every part in its accessible label and skips empty parts", () => {
    render(<SegmentedBar label="Devices" parts={[{ key: "m", label: "Mobile", value: 3 }, { key: "d", label: "Desktop", value: 1 }, { key: "t", label: "Tablet", value: 0 }]} />);
    expect(screen.getByRole("img", { name: "Devices: Mobile 75%, Desktop 25%" })).toBeInTheDocument();
    expect(screen.queryByText("Tablet")).not.toBeInTheDocument();
  });
});
