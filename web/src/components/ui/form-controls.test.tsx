import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Checkbox } from "./checkbox";
import { Switch } from "./switch";
import { RadioGroup, RadioGroupItem } from "./radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

describe("Checkbox", () => {
  it("toggles with mouse and keyboard", async () => {
    const user = userEvent.setup();
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
    render(<Host />);
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
    const user = userEvent.setup();
    function Host() {
      const [on, setOn] = useState(false);
      return <Switch checked={on} onCheckedChange={setOn} aria-label="AI assistant" />;
    }
    render(<Host />);
    const sw = screen.getByRole("switch", { name: "AI assistant" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    await user.click(sw);
    expect(sw).toHaveAttribute("aria-checked", "true");
  });
});

describe("RadioGroup", () => {
  it("moves selection with arrow keys", async () => {
    const user = userEvent.setup();
    render(
      <RadioGroup defaultValue="a" aria-label="Priority">
        <RadioGroupItem value="a" aria-label="A" />
        <RadioGroupItem value="b" aria-label="B" />
      </RadioGroup>,
    );
    await user.tab();
    expect(screen.getByRole("radio", { name: "A" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "B" })).toBeChecked();
  });
});

describe("Select", () => {
  it("opens and selects an option by click", async () => {
    const user = userEvent.setup();
    function Host() {
      const [value, setValue] = useState<string | undefined>();
      return (
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger aria-label="Court">
            <SelectValue placeholder="Choose" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cairo">Cairo</SelectItem>
            <SelectItem value="giza">Giza</SelectItem>
          </SelectContent>
        </Select>
      );
    }
    render(<Host />);
    await user.click(screen.getByRole("combobox", { name: "Court" }));
    await user.click(await screen.findByRole("option", { name: "Giza" }));
    expect(screen.getByRole("combobox", { name: "Court" })).toHaveTextContent("Giza");
  });
});
