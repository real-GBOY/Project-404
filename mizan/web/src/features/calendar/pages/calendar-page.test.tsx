import { Route, Routes } from "react-router-dom";
import { screen } from "@testing-library/react";
import { renderApp } from "@/test/render";
import { CalendarPage } from "./calendar-page";

describe("CalendarPage", () => {
  it("renders the month grid with hearing pills", async () => {
    renderApp(
      <Routes>
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/matters/:id" element={<div>matter</div>} />
      </Routes>,
      { path: "/calendar", perms: ["read:hearing"] },
    );

    expect(await screen.findByText(/Merits hearing/)).toBeInTheDocument();
    expect(screen.getAllByText("Mon").length).toBeGreaterThan(0);
  });
});
