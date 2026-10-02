import type { IconName } from "@/components/ui";

export type Option = { id: string; icon: IconName; title: string; sub?: string; badge?: string };

export type Selection = {
  goal: string;
  exp: string;
  split: string;
  equip: string;
  days: number;
  duration: string;
};

export type Gender = "Male" | "Female" | "Prefer not to say";
export type Body = { age: string; height: string; weight: string; gender: Gender };
export type Units = { h: "cm" | "ft"; w: "kg" | "lbs" };

export type TrainingProfile = { sel: Selection; body: Body; units: Units };
