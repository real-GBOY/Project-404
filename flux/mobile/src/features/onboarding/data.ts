import type { Option } from "./types";

export const GOALS: Option[] = [
  { id: "muscle", icon: "muscle", title: "BUILD MUSCLE", sub: "Add size and definition" },
  { id: "strong", icon: "stronger", title: "GET STRONGER", sub: "Increase your max lifts" },
  { id: "healthy", icon: "healthy", title: "STAY HEALTHY", sub: "General fitness and wellness" },
  { id: "lose", icon: "flame", title: "LOSE WEIGHT", sub: "Burn fat, stay lean" },
  { id: "endure", icon: "endurance", title: "IMPROVE ENDURANCE", sub: "Cardio and conditioning" },
];

export const EXPERIENCE: Option[] = [
  { id: "beg", icon: "sprout", title: "BEGINNER", sub: "Less than 1 year" },
  { id: "int", icon: "bars", title: "INTERMEDIATE", sub: "1 to 3 years" },
  { id: "adv", icon: "flame", title: "ADVANCED", sub: "More than 3 years" },
];

export const SPLITS: Option[] = [
  {
    id: "ppl",
    icon: "zap",
    title: "PUSH / PULL / LEGS",
    sub: "3 days rotation",
    badge: "Most popular",
  },
  {
    id: "ul",
    icon: "upperLower",
    title: "UPPER / LOWER",
    sub: "2 days rotation — great for beginners",
  },
  { id: "fb", icon: "fullbody", title: "FULL BODY", sub: "Train everything each session" },
  { id: "bro", icon: "grid", title: "BRO SPLIT", sub: "Chest day, back day, arm day…" },
  { id: "own", icon: "pencil", title: "BUILD MY OWN", sub: "I'll create my own templates" },
];

export const EQUIPMENT: Option[] = [
  {
    id: "gym",
    icon: "building",
    title: "FULL GYM",
    sub: "Barbells, cables, machines — everything",
  },
  { id: "db", icon: "dumbbell", title: "DUMBBELLS ONLY", sub: "No barbells or machines" },
  {
    id: "bd",
    icon: "barbell",
    title: "BARBELLS + DUMBBELLS",
    sub: "Free weights, no machines",
  },
  { id: "bw", icon: "body", title: "BODYWEIGHT ONLY", sub: "No equipment needed" },
];

export const DURATIONS: Option[] = [
  { id: "d1", icon: "zap", title: "30–45 MIN" },
  { id: "d2", icon: "clock", title: "45–60 MIN" },
  { id: "d3", icon: "muscle", title: "60–90 MIN" },
  { id: "d4", icon: "flame", title: "90+ MIN" },
];

export const DAYS = [2, 3, 4, 5, 6] as const;
export const GENDERS = ["Male", "Female", "Prefer not to say"] as const;
export const STEP_COUNT = 7;
