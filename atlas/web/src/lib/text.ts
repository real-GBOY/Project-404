/** "sales_manager" -> "Sales Manager"; "in-progress" -> "In Progress". Maps backend snake/kebab-case
 *  enum values to the display labels the fixtures used. */
export function titleCase(value: string): string {
  return value
    .split(/[_-]/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
