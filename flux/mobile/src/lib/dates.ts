const DAY_MS = 86_400_000;

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => {
  const x = startOfDay(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();
export const daysBetween = (a: Date, b: Date) =>
  Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / DAY_MS);

/** Monday = 0 … Sunday = 6. */
export const mondayIndex = (d: Date) => (d.getDay() + 6) % 7;

export const startOfWeek = (d: Date) => addDays(d, -mondayIndex(d));

export const WEEKDAY_SHORT = ["M", "T", "W", "T", "F", "S", "S"];
const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const MONTH_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "Mon 9 Jun" */
export const formatSessionDate = (d: Date) =>
  `${WEEKDAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
/** "Jun 2" */
export const formatShortDate = (d: Date) => `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
/** "Mar 2026" */
export const formatMonthYear = (d: Date) => `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
/** "June 2026" */
export const formatMonthTitle = (d: Date) => `${MONTH_FULL[d.getMonth()]} ${d.getFullYear()}`;
/** "January 2026" — long form for "Member since". */
export const formatMemberSince = (d: Date) => `${MONTH_FULL[d.getMonth()]} ${d.getFullYear()}`;
/** "Mon" for the home "Last session" label */
export const weekdayName = (d: Date) => WEEKDAY_NAMES[d.getDay()];

export function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 12) return "Good morning,";
  if (h < 18) return "Good afternoon,";
  return "Good evening,";
}

/** Days in the month plus the Monday-first offset of the 1st. */
export function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  return { offset: mondayIndex(first), days: new Date(year, month + 1, 0).getDate() };
}
