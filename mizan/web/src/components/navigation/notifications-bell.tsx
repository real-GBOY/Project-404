import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useUnreadNotificationsCount } from "@/features/notifications/hooks/use-notifications";
import { Icon } from "@/components/ui/icon";

/**
 * Top-bar bell — the prototype's `36×36` bordered box with a small red presence
 * dot when anything is unread (no numeric badge).
 */
export function NotificationsBell() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const unread = useUnreadNotificationsCount();
  const label =
    unread > 0 ? t("shell.notifications_unread", { count: unread }) : t("nav.notifications");

  return (
    <button
      type="button"
      onClick={() => navigate("/notifications")}
      aria-label={label}
      className="relative flex size-9 items-center justify-center rounded-btn border border-border-tab text-secondary transition-colors hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <Icon name="notifications" size={19} />
      {unread > 0 && (
        <span
          className="absolute end-[8px] top-[7px] size-[7px] rounded-full border-[1.5px] border-surface bg-danger-solid"
          aria-hidden="true"
        />
      )}
    </button>
  );
}
