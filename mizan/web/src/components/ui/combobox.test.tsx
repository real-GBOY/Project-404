import { useState } from "react";
import { fireEvent, screen } from "@testing-library/react";
import { i18n } from "@/lib/i18n";
import { openOverlay, renderWithProviders } from "@/test/render";
import { Combobox, type ComboboxOption } from "./combobox";
import { DatePicker } from "./date-picker";

// See openOverlay — Radix Popover overlays must be driven synchronously in jsdom.

const options: ComboboxOption[] = [
  { value: "tax", label: "Tax dispute" },
  { value: "labor", label: "Labour claim" },
  { value: "corp", label: "Corporate advisory" },
];

describe("Combobox", () => {
  it("filters and selects an option", () => {
    function Host() {
      const [value, setValue] = useState<string | null>(null);
      return (
        <Combobox options={options} value={value} onValueChange={setValue} placeholder="Type" />
      );
    }
    renderWithProviders(<Host />);

    openOverlay(screen.getByRole("combobox"), "click");
    fireEvent.change(screen.getByPlaceholderText("Search"), { target: { value: "lab" } });
    fireEvent.click(screen.getByRole("option", { name: "Labour claim" }));

    expect(screen.getByRole("combobox")).toHaveTextContent("Labour claim");
  });
});

describe("DatePicker", () => {
  // Assert against Latin digits / month names regardless of the ambient locale.
  let previousLanguage: string;
  beforeEach(async () => {
    previousLanguage = i18n.language;
    await i18n.changeLanguage("en");
  });
  afterEach(async () => {
    await i18n.changeLanguage(previousLanguage);
  });

  it("opens a grid and picks a day", () => {
    function Host() {
      const [value, setValue] = useState<string | null>("2026-03-10");
      return (
        <>
          <DatePicker value={value} onValueChange={setValue} />
          <output data-testid="value">{value}</output>
        </>
      );
    }
    renderWithProviders(<Host />);

    openOverlay(screen.getByRole("button", { name: /2026/ }), "click");
    fireEvent.click(screen.getByRole("button", { name: "15" }));

    expect(screen.getByTestId("value")).toHaveTextContent("2026-03-15");
  });
});
