import { trackingOf, type Exercise } from "./catalog";

/** How an exercise is logged: which inputs exist and how a result reads. */
export type Shape = {
  /** Show the weight stepper. */
  load: boolean;
  loadLabel: string;
  repsLabel: string;
  repsStep: number;
  /** Only weight × reps lifts can set a weight PR / carry volume. */
  weighted: boolean;
};

export function shapeOf(ex: Exercise): Shape {
  switch (trackingOf(ex)) {
    case "bodyweight_reps":
      return {
        load: true,
        loadLabel: "Added weight",
        repsLabel: "Reps",
        repsStep: 1,
        weighted: false,
      };
    case "assisted_reps":
      return {
        load: true,
        loadLabel: "Assistance",
        repsLabel: "Reps",
        repsStep: 1,
        weighted: false,
      };
    case "time":
      return { load: false, loadLabel: "", repsLabel: "Duration", repsStep: 5, weighted: false };
    case "reps_only":
      return { load: false, loadLabel: "", repsLabel: "Reps", repsStep: 1, weighted: false };
    default:
      return { load: true, loadLabel: "Weight", repsLabel: "Reps", repsStep: 1, weighted: true };
  }
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

type Fmt = { show: (kg: number) => string; short: string };

/** "80 kg × 8", "BW +5 kg × 8", "1:15", "20 reps" … */
export function fmtResult(ex: Exercise, kg: number, reps: number, u: Fmt): string {
  switch (trackingOf(ex)) {
    case "bodyweight_reps":
      return `BW +${u.show(kg)} ${u.short} × ${reps}`;
    case "assisted_reps":
      return `−${u.show(kg)} ${u.short} assist × ${reps}`;
    case "time":
      return mmss(reps);
    case "reps_only":
      return `${reps} reps`;
    default:
      return `${u.show(kg)} ${u.short} × ${reps}`;
  }
}

/** Same as fmtResult but with a rep range, for targets. */
export function fmtTarget(ex: Exercise, kg: number, low: number, high: number, u: Fmt): string {
  const t = trackingOf(ex);
  if (t === "time") return mmss(low);
  const range = low === high ? String(low) : `${low}-${high}`;
  if (t === "reps_only") return `${range} reps`;
  return fmtResult(ex, kg, 0, u).replace(/× 0$/, `× ${range}`);
}
