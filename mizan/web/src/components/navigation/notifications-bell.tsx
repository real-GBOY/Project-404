import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useUnreadNotificationsCount } from "@/features/notifications/hooks/use-notifications";
import { Icon } from "@/components/ui/icon";

export function NotificationsBell() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const unread = useUnreadNotificationsCount();
  const label = unread > 0 ? t("shell.notifications_unread", { count: unread }) : t("nav.notifications");

  return (
    <button
      type="button"
      onClick={() => navigate("/notifications")}
      aria-label={label}
      className="relative flex size-9 items-center justify-center rounded-md text-foreground-body hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <Icon name="notifications" size={19} />
      {unread > 0 && (
        <span className="absolute end-1 top-1 flex min-w-4 items-center justify-center rounded-pill bg-danger px-1 text-[9.5px] font-bold leading-4 text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );
}
