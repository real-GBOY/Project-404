import { Route, Routes } from "react-router-dom";
import { screen } from "@testing-library/react";
import { ApiError } from "@/lib/api/api-error";
import { renderApp } from "@/test/render";
import { LoginPage } from "./login-page";

function Harness() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<div>dashboard</div>} />
      <Route path="/login/organization" element={<div>pick an org</div>} />
      <Route path="/login/forgot" element={<div>forgot form</div>} />
    </Routes>
  );
}

describe("LoginPage", () => {
  it("validates the email before submitting", async () => {
    const login = vi.fn();
    const { user } = renderApp(<Harness />, { path: "/login", status: "anon", auth: { login } });

    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.type(screen.getByLabelText("Password"), "whatever123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it("signs in and lands on the dashboard", async () => {
    const login = vi.fn().mockResolvedValue({ needsOrgSelection: false, hasNoOrg: false });
    const { user } = renderApp(<Harness />, { path: "/login", status: "anon", auth: { login } });

    await user.type(screen.getByLabelText("Email"), "amira@tawfik.eg");
    await user.type(screen.getByLabelText("Password"), "correct-horse");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(login).toHaveBeenCalledWith("amira@tawfik.eg", "correct-horse");
    expect(await screen.findByText("dashboard")).toBeInTheDocument();
  });

  it("routes to the org selector when the session has no active tenant", async () => {
    const login = vi.fn().mockResolvedValue({ needsOrgSelection: true, hasNoOrg: false });
    const { user } = renderApp(<Harness />, { path: "/login", status: "anon", auth: { login } });

    await user.type(screen.getByLabelText("Email"), "amira@tawfik.eg");
    await user.type(screen.getByLabelText("Password"), "correct-horse");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("pick an org")).toBeInTheDocument();
  });

  it("shows a friendly message on bad credentials", async () => {
    const login = vi
      .fn()
      .mockRejectedValue(new ApiError(401, { code: "identity.invalid_credentials", message: "nope" }));
    const { user } = renderApp(<Harness />, { path: "/login", status: "anon", auth: { login } });

    await user.type(screen.getByLabelText("Email"), "amira@tawfik.eg");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password.");
  });
});
