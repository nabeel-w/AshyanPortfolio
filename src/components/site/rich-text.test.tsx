import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RichText } from "./rich-text";

const html = (text: string) =>
  render(<p>{<RichText text={text} />}</p>).container.firstElementChild!;

describe("<RichText>", () => {
  it("renders plain text untouched", () => {
    expect(html("Crafting visual stories").innerHTML).toBe("Crafting visual stories");
  });

  it("turns *words* into a red italic accent", () => {
    const p = html("Crafting *through edit.*");
    const em = p.querySelector("em")!;
    expect(em).toHaveTextContent("through edit.");
    expect(em).toHaveClass("text-red", "italic");
    expect(p).toHaveTextContent("Crafting through edit.");
  });

  it("turns **WORDS** into small sans caps", () => {
    const span = html("**Every frame** has a reason").querySelector("span")!;
    expect(span).toHaveTextContent("Every frame");
    expect(span).toHaveClass("font-sans", "uppercase");
  });

  it("handles mixed markup in order", () => {
    const p = html("**A** b *c* d **E**");
    expect([...p.childNodes].map((n) => (n as Element).tagName ?? "#text")).toEqual([
      "SPAN",
      "#text",
      "EM",
      "#text",
      "SPAN",
    ]);
  });

  it("never renders HTML from content", () => {
    const p = html('<img src=x onerror="alert(1)"> *hi*');
    expect(p.querySelector("img")).toBeNull();
    expect(p).toHaveTextContent('<img src=x onerror="alert(1)"> hi');
  });

  it("accepts an extra class for the accent", () => {
    expect(
      render(<RichText text="*x*" accentClassName="not-italic" />).container.querySelector("em"),
    ).toHaveClass("not-italic");
  });
});
