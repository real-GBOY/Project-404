import { Route, Routes } from "react-router-dom";
import { screen } from "@testing-library/react";
import { renderApp } from "@/test/render";
import { ResetPasswordPage } from "./reset-password-page";
import { VerifyEmailPage } from "./verify-email-page";

function Harness() {
  return (
    <Routes>
      <Route path="/login/reset" element={<ResetPasswordPage />} />
      <Route path="/login/verify" element={<VerifyEmailPage />} />
      <Route path="/login" element={<div>sign in screen</div>} />
      <Route path="/login/forgot" element={<div>forgot form</div>} />
    </Routes>
  );
}

describe("ResetPasswordPage", () => {
  it("refuses to render a form without a token", () => {
    renderApp(<Harness />, { path: "/login/reset", status: "anon" });
    expect(screen.getByText("Link not valid")).toBeInTheDocument();
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
  });

  it("blocks mismatched passwords", async () => {
    const { user } = renderApp(<Harness />, { path: "/login/reset?token=ok", status: "anon" });
    await user.type(screen.getByLabelText("New password"), "abcdefghij1");
    await user.type(screen.getByLabelText("Confirm password"), "different123");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    expect(screen.getByText("The passwords don't match.")).toBeInTheDocument();
  });

  it("updates the password and returns to sign in", async () => {
    const { user } = renderApp(<Harness />, { path: "/login/reset?token=ok", status: "anon" });
    await user.type(screen.getByLabelText("New password"), "a-good-long-password");
    await user.type(screen.getByLabelText("Confirm password"), "a-good-long-password");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByText("sign in screen")).toBeInTheDocument();
  });

  it("surfaces an expired token", async () => {
    const { user } = renderApp(<Harness />, { path: "/login/reset?token=expired", status: "anon" });
    await user.type(screen.getByLabelText("New password"), "a-good-long-password");
    await user.type(screen.getByLabelText("Confirm password"), "a-good-long-password");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid or has expired/i);
  });
});

describe("VerifyEmailPage", () => {
  it("confirms a valid token", async () => {
    renderApp(<Harness />, { path: "/login/verify?token=ok", status: "anon" });
    expect(await screen.findByText("Email verified")).toBeInTheDocument();
  });

  it("offers a resend when the token is rejected", async () => {
    renderApp(<Harness />, { path: "/login/verify?token=bad", status: "anon" });
    expect(await screen.findByText("Couldn't verify")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send a new link" })).toBeInTheDocument();
  });
});
