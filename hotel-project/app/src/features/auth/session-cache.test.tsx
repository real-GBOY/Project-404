import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderApp, stubApi } from "@/test/render";
import { useAuth } from "./use-auth";

function Probe() {
  const auth = useAuth();
  const qc = useQueryClient();
  const [, rerender] = useState(0);
  return (
    <>
      <button type="button" onClick={() => rerender((n) => n + 1)}>
        look
      </button>
      <button type="button" onClick={() => qc.setQueryData(["notifications"], { unreadCount: 3 })}>
        cache
      </button>
      <button type="button" onClick={auth.logout}>
        sign out
      </button>
      <output>{qc.getQueryCache().getAll().length > 0 ? "cached" : "empty"}</output>
    </>
  );
}

describe("Session change", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("drops every cached query on sign-out, so the next person at the desk sees none of it", async () => {
    stubApi({ permissions: [] });
    renderApp(<Probe />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "cache" }));
    await user.click(screen.getByRole("button", { name: "look" }));
    expect(screen.getByRole("status")).toHaveTextContent("cached");
    await user.click(screen.getByRole("button", { name: "sign out" }));
    await user.click(screen.getByRole("button", { name: "look" }));
    expect(screen.getByRole("status")).toHaveTextContent("empty");
  });
});
