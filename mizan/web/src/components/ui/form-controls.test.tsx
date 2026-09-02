import { useState } from "react";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { Checkbox } from "./checkbox";
import { Switch } from "./switch";
import { RadioGroup, RadioGroupItem } from "./radio-group";

describe("Checkbox", () => {
  it("toggles with mouse and keyboard", async () => {
    function Host() {
      const [checked, setChecked] = useState(false);
      return (
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => setChecked(v === true)}
          aria-label="Accept"
        />
      );
    }
    const { user } = renderWithProviders(<Host />);
    const box = screen.getByRole("checkbox", { name: "Accept" });
    expect(box).not.toBeChecked();
    await user.click(box);
    expect(box).toBeChecked();
    await user.keyboard(" ");
    expect(box).not.toBeChecked();
  });
});

describe("Switch", () => {
  it("exposes a switch role and flips on click", async () => {
    function Host() {
      const [on, setOn] = useState(false);
      return <Switch checked={on} onCheckedChange={setOn} aria-label="AI assistant" />;
    }
    const { user } = renderWithProviders(<Host />);
    const sw = screen.getByRole("switch", { name: "AI assistant" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    await user.click(sw);
    expect(sw).toHaveAttribute("aria-checked", "true");
  });
});

describe("RadioGroup", () => {
  it("selects the clicked option", async () => {
    const onValueChange = vi.fn();
    const { user } = renderWithProviders(
      <RadioGroup defaultValue="a" onValueChange={onValueChange} aria-label="Priority">
        <RadioGroupItem value="a" aria-label="A" />
        <RadioGroupItem value="b" aria-label="B" />
      </RadioGroup>,
    );
    await user.click(screen.getByRole("radio", { name: "B" }));
    expect(screen.getByRole("radio", { name: "B" })).toBeChecked();
    expect(onValueChange).toHaveBeenCalledWith("b");
  });
});
