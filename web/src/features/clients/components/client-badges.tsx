import { useTranslation } from "react-i18next";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { ClientStatus, ClientType } from "../types/client";

export function ClientTypeBadge({ type }: { type: ClientType }) {
  const { t } = useTranslation("clients");
  return (
    <Badge tone="neutral" size="sm">
      {t(`type.${type}`)}
    </Badge>
  );
}

const STATUS_TONE: Record<ClientStatus, BadgeTone> = { active: "success", archived: "neutral" };

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  const { t } = useTranslation("clients");
  if (status === "active") return null;
  return (
    <Badge tone={STATUS_TONE[status]} size="sm">
      {t(`status.${status}`)}
    </Badge>
  );
}
