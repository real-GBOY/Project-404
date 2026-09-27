import { useAuth } from "@/features/auth/use-auth";
import { firstName, formatLongDate, greeting } from "@/lib/format";

/**
 * Dashboard — "What is happening in the hotel today?". The design's header (greeting + the
 * hotel's date). Operational widgets arrive with the modules that own their data; nothing here
 * is a placeholder number.
 */
export function DashboardPage() {
  const auth = useAuth();
  const now = new Date();
  return (
    <div className="mb-[26px] flex items-start justify-between">
      <div>
        <h1 className="m-0 text-display font-extrabold tracking-[-0.01em]">
          {greeting(now)}, {firstName(auth.user?.displayName)}
        </h1>
        <p className="m-0 mt-[3px] text-body text-muted">{formatLongDate(now)}</p>
      </div>
    </div>
  );
}
