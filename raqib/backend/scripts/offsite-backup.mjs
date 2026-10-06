// Copies one database dump into R2 under backups/ and deletes the ones older than KEEP days. Run by scripts/raqib-backup.sh on the
// VPS with the service's environment loaded; it reuses Core's R2 adapter from the deployed build, so there is nothing else to install.
import { readFile } from "node:fs/promises";
import { R2Adapter } from "/opt/raqib/dist/core/files/infrastructure/r2-adapter.js";

const [file, name] = process.argv.slice(2);
const need = (k) => process.env[k] || (console.error(`missing ${k}`), process.exit(1));
const keep = Number(process.env.KEEP ?? 14);

const r2 = new R2Adapter({
  accountId: need("AURIC_R2_ACCOUNT_ID"),
  bucket: need("AURIC_R2_BUCKET"),
  accessKeyId: need("AURIC_R2_ACCESS_KEY_ID"),
  secretAccessKey: need("AURIC_R2_SECRET_ACCESS_KEY"),
  keyPrefix: `${process.env.AURIC_R2_KEY_PREFIX ? process.env.AURIC_R2_KEY_PREFIX + "/" : ""}backups`,
});

const bytes = await readFile(file);
await r2.put(name, bytes);
const head = await r2.head(name);
if (!head || head.size !== bytes.length) {
  console.error(`offsite copy failed verification (${head?.size} of ${bytes.length} bytes)`);
  process.exit(1);
}
console.log(`offsite backup: ${name} (${bytes.length} bytes) verified in R2`);

// prune: delete the dumps from the days just outside the window (removing a missing object is fine)
for (let d = keep + 1; d <= keep + 30; d++) {
  const day = new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10);
  await r2.remove(`raqib-${day}.dump`);
}
