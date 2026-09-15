/**
 * Buckets an ISO date relative to now, for list-screen filters where the
 * underlying value is a date but a plain distinct-value dropdown (one option
 * per unique date) would be useless — "Overdue" / "This week" groups real
 * dates into real, meaningful ranges instead of inventing categories.
 */
export function futureDateBucket(dateIso: string | null | undefined): string {
  if (!dateIso) return "Not set";
  const days = Math.ceil((new Date(dateIso).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "Overdue";
  if (days <= 7) return "This week";
  if (days <= 31) return "This month";
  return "Later";
}

/** Same idea, looking backward (e.g. "when was this paid") rather than forward. */
export function pastDateBucket(dateIso: string | null | undefined): string {
  if (!dateIso) return "Unknown";
  const days = Math.floor((Date.now() - new Date(dateIso).getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days <= 7) return "This week";
  if (days <= 31) return "This month";
  return "Earlier";
}
