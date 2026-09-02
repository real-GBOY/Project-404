import { Route, Routes } from "react-router-dom";
import { screen } from "@testing-library/react";
import { renderApp } from "@/test/render";
import { SettingsLayout } from "./settings-layout";
import { AuditSection, FirmProfileSection, UsersRolesSection } from "./settings-sections";

function Harness() {
  return (
    <Routes>
      <Route path="/settings" element={<SettingsLayout />}>
        <Route index element={<FirmProfileSection />} />
        <Route path="users" element={<UsersRolesSection />} />
        <Route path="audit" element={<AuditSection />} />
      </Route>
    </Routes>
  );
}

describe("Settings", () => {
  it("shows the firm profile and navigates between sections", async () => {
    const { user } = renderApp(<Harness />, {
      path: "/settings",
      perms: ["read:lawfirm_setting", "read:role", "read:audit_log"],
    });

    expect(await screen.findByDisplayValue("Tawfik & Partners")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: /Users & roles/ }));
    expect(await screen.findByText("Firm administrator")).toBeInTheDocument();
  });

  it("hides sections the user can't read", async () => {
    renderApp(<Harness />, { path: "/settings", perms: ["read:lawfirm_setting"] });
    await screen.findByDisplayValue("Tawfik & Partners");
    expect(screen.queryByRole("link", { name: /Security & audit/ })).not.toBeInTheDocument();
  });
});
