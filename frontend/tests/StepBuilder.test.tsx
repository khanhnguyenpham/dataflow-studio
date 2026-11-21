import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import StepBuilder from "../src/StepBuilder";
import i18n from "../src/i18n";
afterEach(cleanup);

test("a mixed-format file can explicitly allow ISO and day-first dates", async () => {
  await i18n.changeLanguage("en");
  const add = vi.fn();
  render(
    <StepBuilder columns={["Order Date"]} onAdd={add} busy={false} count={0} />,
  );
  fireEvent.change(screen.getByRole("combobox", { name: "Operation" }), {
    target: { value: "date" },
  });
  const formats = screen.getByRole("listbox", {
    name: "Input date formats (select all allowed)",
  }) as HTMLSelectElement;
  formats.options[0].selected = true;
  formats.options[1].selected = true;
  fireEvent.submit(
    screen.getByRole("button", { name: "Add step" }).closest("form")!,
  );
  expect(add).toHaveBeenCalledWith({
    op: "date",
    column: "Order Date",
    formats: ["%Y-%m-%d", "%d/%m/%Y"],
  });
});
