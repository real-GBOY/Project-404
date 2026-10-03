/** The training profile collected by onboarding and stored on the account. */
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

/** Defaults the onboarding wizard starts from; also used for guest sign-in. */
export const DEFAULT_PROFILE: TrainingProfile = {
  sel: { goal: "muscle", exp: "int", split: "ppl", equip: "gym", days: 4, duration: "d3" },
  body: { age: "21", height: "178", weight: "75", gender: "Male" },
  units: { h: "cm", w: "kg" },
};
