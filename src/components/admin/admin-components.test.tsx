import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { FieldDef } from "@/features/admin/fields";
import { sectionFields } from "@/features/admin/fields";
import { sectionSchemas } from "@/features/sections/schemas";

vi.mock("@/features/media/actions", () => ({ listAssetsAction: vi.fn(async () => []), completeUploadAction: vi.fn() }));
vi.mock("@/features/media/client/upload", () => ({ uploadFile: vi.fn() }));

const { ConfirmButton } = await import("./confirm-button");
const { SchemaForm } = await import("./schema-form");

describe("<ConfirmButton>", () => {
  it("needs two clicks before running the action", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfirmButton confirmLabel="Yes, discard" onConfirm={onConfirm}>
        Discard
      </ConfirmButton>,
    );
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(onConfirm).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Yes, discard" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button")).toHaveTextContent("Discard");
  });

  it("disarms itself after 4 seconds", () => {
    vi.useFakeTimers();
    const onConfirm = vi.fn();
    render(
      <ConfirmButton confirmLabel="Sure?" onConfirm={onConfirm}>
        Delete
      </ConfirmButton>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toHaveTextContent("Sure?");
    act(() => vi.advanceTimersByTime(4100));
    expect(screen.getByRole("button")).toHaveTextContent("Delete");
    fireEvent.click(screen.getByRole("button"));
    expect(onConfirm).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

/** Controlled harness so every change re-renders like the real editor. */
function Harness({ fields, initial, onValue }: { fields: FieldDef[]; initial: Record<string, unknown>; onValue: (v: Record<string, unknown>) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <SchemaForm
      fields={fields}
      value={value}
      onChange={(v) => {
        setValue(v);
        onValue(v);
      }}
    />
  );
}

describe("<SchemaForm>", () => {
  it("edits nested group fields without losing siblings", async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(
      <Harness
        fields={[{ type: "group", name: "cta", label: "Button", fields: [{ type: "text", name: "label", label: "Label" }, { type: "text", name: "href", label: "Link" }] }]}
        initial={{ cta: { label: "Old", href: "/work" } }}
        onValue={onValue}
      />,
    );
    const label = screen.getByLabelText("Label");
    await user.clear(label);
    await user.type(label, "New");
    expect(onValue).toHaveBeenLastCalledWith({ cta: { label: "New", href: "/work" } });
  });

  it("adds, reorders and removes list items", async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(
      <Harness
        fields={[
          {
            type: "list",
            name: "stats",
            label: "Key numbers",
            itemTitle: "label",
            addLabel: "Add number",
            newItem: { value: "", label: "" },
            item: [
              { type: "text", name: "value", label: "Value" },
              { type: "text", name: "label", label: "Label" },
            ],
          },
        ]}
        initial={{ stats: [{ value: "8+", label: "Years" }, { value: "150+", label: "Projects" }] }}
        onValue={onValue}
      />,
    );
    await user.click(screen.getAllByRole("button", { name: "Move down" })[0]!);
    expect(onValue).toHaveBeenLastCalledWith({ stats: [{ value: "150+", label: "Projects" }, { value: "8+", label: "Years" }] });
    await user.click(screen.getByRole("button", { name: "+ Add number" }));
    expect((onValue.mock.lastCall![0] as { stats: unknown[] }).stats).toHaveLength(3);
    await user.click(screen.getAllByRole("button", { name: "Remove" })[0]!);
    expect((onValue.mock.lastCall![0] as { stats: { label: string }[] }).stats[0]!.label).toBe("Years");
  });

  it("edits string lists one item per line, trimming blanks on blur", async () => {
    const onValue = vi.fn();
    render(<Harness fields={[{ type: "lines", name: "names", label: "Names" }]} initial={{ names: ["Nike"] }} onValue={onValue} />);
    const box = screen.getByLabelText("Names");
    fireEvent.change(box, { target: { value: "Nike\n  Sony \n\n" } });
    fireEvent.blur(box);
    expect(onValue).toHaveBeenLastCalledWith({ names: ["Nike", "Sony"] });
  });

  it("shows validation errors next to the right field", () => {
    render(
      <SchemaForm fields={[{ type: "email", name: "email", label: "Email" }]} value={{ email: "x" }} onChange={() => {}} errors={{ email: "Invalid email" }} />,
    );
    expect(screen.getByText("Invalid email")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  });

  it("has a form config for every section type, and every field exists on its schema", () => {
    for (const [type, schema] of Object.entries(sectionSchemas)) {
      const fields = sectionFields[type as keyof typeof sectionFields];
      expect(fields, type).toBeDefined();
      const keys = Object.keys(schema.shape);
      for (const f of fields.filter((f) => f.type !== "note")) expect(keys, `${type}.${f.name}`).toContain(f.name);
    }
  });
});
