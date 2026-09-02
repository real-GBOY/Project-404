import { useState } from "react";
import { screen } from "@testing-library/react";
import { i18n } from "@/lib/i18n";
import { renderWithProviders } from "@/test/render";
import { Combobox, type ComboboxOption } from "./combobox";
import { DatePicker } from "./date-picker";

const options: ComboboxOption[] = [
  { value: "tax", label: "Tax dispute" },
  { value: "labor", label: "Labour claim" },
  { value: "corp", label: "Corporate advisory" },
];

describe("Combobox", () => {
  it("filters and selects an option", async () => {
    function Host() {
      const [value, setValue] = useState<string | null>(null);
      return <Combobox options={options} value={value} onValueChange={setValue} placeholder="Type" />;
    }
    const { user } = renderWithProviders(<Host />);

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("lab");
    await user.click(await screen.findByRole("option", { name: "Labour claim" }));

    expect(screen.getByRole("combobox")).toHaveTextContent("Labour claim");
  });
});

describe("DatePicker", () => {
  // Assert against Latin digits / month names — independent of the AR default.
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });
  afterEach(async () => {
    await i18n.changeLanguage("ar");
  });

  it("opens a grid and picks a day", async () => {
    function Host() {
      const [value, setValue] = useState<string | null>("2026-03-10");
      return (
        <>
          <DatePicker value={value} onValueChange={setValue} />
          <output data-testid="value">{value}</output>
        </>
      );
    }
    const { user } = renderWithProviders(<Host />);

    await user.click(screen.getByRole("button", { name: /2026/ }));
    await user.click(screen.getByRole("button", { name: "15" }));

    expect(screen.getByTestId("value")).toHaveTextContent("2026-03-15");
  });
});
