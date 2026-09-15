import { sql, type RawBuilder } from "kysely";

/**
 * Real relevance ranking for backend text search — not a flat boolean filter.
 * One column's score against a search term:
 *
 *   100  exact match (case-insensitive)
 *    80  starts with the term
 *    60  a word inside the text starts with the term (word-boundary prefix)
 *    40  contains the term anywhere
 *     0  no match
 *
 * Deliberately plain `ILIKE`/`LIKE` scoring rather than `pg_trgm`/`tsvector` —
 * this portfolio's row counts don't need a new Postgres extension and index
 * to search well, and this stays fully explainable in one glance.
 */
export function relevance(column: string, term: string): RawBuilder<number> {
  const col = sql.ref(column);
  // Cast to numeric: an all-integer-literal CASE is typed `integer` by
  // Postgres, and `combinedRelevance` below multiplies it by a fractional
  // weight — an untyped parameter in an integer context fails to bind.
  return sql<number>`
    (CASE
      WHEN lower(${col}) = lower(${term}) THEN 100
      WHEN lower(${col}) LIKE lower(${term}) || '%' THEN 80
      WHEN lower(${col}) LIKE '% ' || lower(${term}) || '%' THEN 60
      WHEN lower(${col}) LIKE '%' || lower(${term}) || '%' THEN 40
      ELSE 0
    END)::numeric
  `;
}

/**
 * Combines several columns' relevance into one score for a row: the best
 * single-column match wins, with `weight` (0-1) discounting secondary fields
 * (e.g. a phone-number match matters less than a name match) so the primary
 * field still dominates ordering when both match.
 */
export function combinedRelevance(columns: Array<{ column: string; weight?: number }>, term: string): RawBuilder<number> {
  const parts = columns.map(({ column, weight = 1 }) => {
    const score = relevance(column, term);
    return weight === 1 ? score : sql<number>`(${score} * ${weight}::numeric)`;
  });
  return sql<number>`GREATEST(${sql.join(parts, sql`, `)})`;
}
