import type { TabOption } from "@/components/ui/Chips";
import { colors } from "@/theme/tokens";
import type { SetType } from "@/features/training/types";

/** Set-type selector options; the selected chip takes the type's own colours. */
export const SET_TYPE_OPTIONS: TabOption<SetType>[] = [
  { id: "normal", label: "Normal" },
  { id: "warmup", label: "Warm-up", activeBg: colors.segment, activeFg: colors.sub },
  { id: "dropset", label: "Drop Set", activeBg: colors.dropBg, activeFg: colors.drop },
  { id: "failure", label: "Failure", activeBg: colors.plateauBg, activeFg: colors.plateauTitle },
];

/** Badge in the set row: a letter for non-normal sets, with its colours. */
export const SET_TYPE_BADGE: Record<SetType, { tag: string | null; bg: string; fg: string }> = {
  normal: { tag: null, bg: colors.limeTintStrong, fg: colors.limeDeep },
  warmup: { tag: "W", bg: colors.segment, fg: colors.sub },
  dropset: { tag: "D", bg: colors.dropBg, fg: colors.drop },
  failure: { tag: "F", bg: colors.plateauBg, fg: colors.plateauTitle },
};
