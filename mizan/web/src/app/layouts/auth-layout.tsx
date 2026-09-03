import { Outlet } from "react-router-dom";
import { MizanLogo } from "@/components/ui/logo";

/** Centered card layout for login / password / verification screens (F3). */
export function AuthLayout() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex justify-center">
          <MizanLogo size={36} wordSize={24} strapline />
        </div>
        <div className="rounded-card border border-border bg-surface p-6 shadow-input">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
