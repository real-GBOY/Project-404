import { Outlet } from "react-router-dom";

/** Centered card layout for login / password / verification screens (F3). */
export function AuthLayout() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-base font-extrabold text-primary-foreground">
            M
          </div>
          <span className="text-lg font-extrabold tracking-tight">Mizan</span>
        </div>
        <div className="rounded-lg border border-border bg-surface p-6 shadow-card">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
