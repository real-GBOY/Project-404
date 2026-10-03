import { EXERCISES, type Exercise, type Muscle } from "@/features/training/catalog";

export const MUSCLE_FILTERS: ("All" | Muscle)[] = [
  "All",
  "Chest",
  "Back",
  "Shoulders",
  "Arms",
  "Legs",
  "Core",
];

const EQUIPMENT: Record<string, string> = {
  bench: "Barbell",
  incdb: "Dumbbell",
  fly: "Cable",
  ohp: "Barbell",
  tripush: "Cable",
  deadlift: "Barbell",
  row: "Barbell",
  latpd: "Cable",
  facepull: "Cable",
  curl: "Dumbbell",
  squat: "Barbell",
  rdl: "Barbell",
  legpress: "Machine",
  legcurl: "Machine",
  calf: "Machine",
  plank: "Bodyweight",
  pullup: "Bodyweight",
  asspull: "Machine",
  pushup: "Bodyweight",
  plankhold: "Bodyweight",
};

export const equipmentOf = (e: Exercise) => EQUIPMENT[e.id] ?? "Other";

/** Starred by default — the lifts most people anchor a program around. */
export const FAVORITE_IDS = ["bench", "ohp", "deadlift", "squat", "latpd", "curl"];

export const ALL_EXERCISES: Exercise[] = Object.values(EXERCISES);
