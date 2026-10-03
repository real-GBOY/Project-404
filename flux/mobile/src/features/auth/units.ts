import { useSession } from "@/features/auth/session";

const LB_PER_KG = 2.20462;

const trim = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Weights are stored in kg; this renders them in the user's chosen unit. */
export function useUnits() {
  const { settings } = useSession();
  const lbs = settings.units === "LBS";
  return {
    /** "KG" | "LBS" — for big Bebas unit labels. */
    label: settings.units,
    /** "kg" | "lbs" — for small inline labels. */
    short: lbs ? "lbs" : "kg",
    /** Display value for a weight stored in kg. */
    show: (kg: number) => trim(lbs ? Math.round(kg * LB_PER_KG * 2) / 2 : kg),
  };
}
