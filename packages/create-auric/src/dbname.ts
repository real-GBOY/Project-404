/**
 * The default database name for a generated project: the project name, made safe for a bare SQL identifier.
 *
 * It must NOT be a fixed name like `auric`: the first migration creates every table and refuses to run over a
 * database that already has them, so a shared default collides with any other AURIC project on the machine.
 */
export function defaultDatabaseName(projectName: string): string {
  const slug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return slug ? (/^[a-z]/.test(slug) ? slug : `db_${slug}`) : "app";
}
