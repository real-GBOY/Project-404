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

    // Fixtures are dated relative to "today", so more than one hearing with this purpose can
    // land in the visible window — assert presence, not uniqueness.
    expect((await screen.findAllByText(/Merits hearing/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mon").length).toBeGreaterThan(0);
  });
});
