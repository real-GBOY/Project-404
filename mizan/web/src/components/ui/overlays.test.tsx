import { useState } from "react";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./dialog";
import { ConfirmDialog } from "./confirm-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { SegmentedControl } from "./segmented-control";
import { useToast } from "./toast-context";
import { Button } from "./button";

describe("Dialog", () => {
  it("opens from its trigger and closes on Escape", async () => {
    const { user } = renderWithProviders(
      <Dialog>
        <DialogTrigger asChild>
          <button type="button">Open</button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New matter</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("dialog", { name: "New matter" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("ConfirmDialog", () => {
  it("runs onConfirm then closes", async () => {
    const onConfirm = vi.fn();
    function Host() {
      const [open, setOpen] = useState(true);
      return (
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title="Void invoice?"
          confirmLabel="Void"
          destructive
          onConfirm={onConfirm}
        />
      );
    }
    const { user } = renderWithProviders(<Host />);
    await user.click(screen.getByRole("button", { name: "Void" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});

describe("Tabs", () => {
  it("switches panels with arrow keys", async () => {
    const { user } = renderWithProviders(
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="hearings">Hearings</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">Overview panel</TabsContent>
        <TabsContent value="hearings">Hearings panel</TabsContent>
      </Tabs>,
    );
    await user.tab();
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByText("Hearings panel")).toBeInTheDocument();
  });
});

describe("SegmentedControl", () => {
  it("reports the chosen value", async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <SegmentedControl
        aria-label="View"
        value="table"
        onValueChange={onChange}
        options={[
          { value: "table", label: "Table" },
          { value: "grid", label: "Grid" },
        ]}
      />,
    );
    await user.click(screen.getByRole("radio", { name: "Grid" }));
    expect(onChange).toHaveBeenCalledWith("grid");
  });
});

describe("useToast", () => {
  it("shows a message in a live region", async () => {
    function Host() {
      const toast = useToast();
      return <Button onClick={() => toast.success({ title: "Saved" })}>Go</Button>;
    }
    const { user } = renderWithProviders(<Host />);
    await user.click(screen.getByRole("button", { name: "Go" }));
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });
});
