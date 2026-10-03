import type { IconName } from "@/components/ui";

export type { Body, Gender, Selection, TrainingProfile, Units } from "@/features/auth/profile";

export type Option = { id: string; icon: IconName; title: string; sub?: string; badge?: string };
