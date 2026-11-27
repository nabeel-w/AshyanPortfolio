import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LabelChip, LabelTags } from "./label-chip";

describe("<LabelChip> (#28)", () => {
  it("is a real link to the label page with an analytics tag and a 44px target", () => {
    render(<LabelChip label={{ name: "Fashion", slug: "fashion", count: 6 }} />);
    const link = screen.getByRole("link", { name: /Fashion/ });
    expect(link).toHaveAttribute("href", "/work/label/fashion");
    expect(link).toHaveAttribute("data-cta", "label:fashion");
    expect(link).toHaveClass("hit-44");
    expect(link).toHaveTextContent("06");
    expect(link).not.toHaveAttribute("aria-current");
  });

  it("marks the active chip with aria-current (the red dot follows it)", () => {
    render(<LabelChip label={{ name: "Fashion", slug: "fashion" }} active />);
    expect(screen.getByRole("link")).toHaveAttribute("aria-current", "page");
  });

  it("card tags show at most two labels, separated by a dot", () => {
    const { container } = render(
      <LabelTags labels={[{ name: "A", slug: "a" }, { name: "B", slug: "b" }, { name: "C", slug: "c" }]} />,
    );
    expect(screen.getAllByRole("link").map((l) => l.textContent)).toEqual(["A", "B"]);
    expect(container).toHaveTextContent("A·B");
  });
});
