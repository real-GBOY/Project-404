import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { DataTable, type Column } from "./data-table";
import { Pagination } from "./pagination";

interface Row {
  id: string;
  name: string;
}

const columns: Column<Row>[] = [
  { id: "name", header: "Name", cell: (r) => r.name, sortable: true },
];
const rows: Row[] = [
  { id: "1", name: "Alpha" },
  { id: "2", name: "Beta" },
];

describe("DataTable", () => {
  it("renders rows and calls onRowClick", async () => {
    const onRowClick = vi.fn();
    const { user } = renderWithProviders(
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} onRowClick={onRowClick} />,
    );
    await user.click(screen.getByText("Alpha"));
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });

  it("toggles sort direction on header click", async () => {
    const onSortChange = vi.fn();
    const { user } = renderWithProviders(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        sort={{ column: "name", direction: "asc" }}
        onSortChange={onSortChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Name/ }));
    expect(onSortChange).toHaveBeenCalledWith({ column: "name", direction: "desc" });
  });

  it("shows a skeleton while loading", () => {
    renderWithProviders(
      <DataTable columns={columns} rows={[]} rowKey={(r) => r.id} isLoading />,
    );
    expect(screen.getByRole("status", { name: /loading/i })).toBeInTheDocument();
  });
});

describe("Pagination", () => {
  it("hides itself for a single page", () => {
    const { container } = renderWithProviders(
      <Pagination page={1} pageCount={1} onPageChange={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("navigates to a chosen page", async () => {
    const onPageChange = vi.fn();
    const { user } = renderWithProviders(
      <Pagination page={1} pageCount={5} onPageChange={onPageChange} />,
    );
    await user.click(screen.getByRole("button", { name: "3" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});
