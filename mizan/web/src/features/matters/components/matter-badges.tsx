import { useTranslation } from "react-i18next";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { MatterStatus } from "../types/matter";

const TONE: Record<MatterStatus, BadgeTone> = { open: "info", on_hold: "warning", closed: "neutral" };

export function MatterStatusBadge({ status }: { status: MatterStatus }) {
  const { t } = useTranslation("matters");
  return (
    <Badge tone={TONE[status]} size="sm">
      {t(`status.${status}`)}
    </Badge>
  );
}
