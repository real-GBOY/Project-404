/**
 * End-to-end smoke test for the R2 storage driver against the *real*
 * Cloudflare R2 bucket. Exercises the same code paths the presigned-upload
 * flow uses in production:
 *
 *   presignPut ─→ browser-style PUT to the signed URL (no Authorization header)
 *             ─→ head()  (the confirm step's landing check)
 *             ─→ get()   (private download)
 *             ─→ url()   (presigned GET) fetched with a bare client
 *             ─→ remove()
 *
 * Run:
 *   AURIC_R2_ACCOUNT_ID=... AURIC_R2_ACCESS_KEY_ID=... \
 *   AURIC_R2_SECRET_ACCESS_KEY=... AURIC_R2_BUCKET=mizan-files \
 *   npx tsx scripts/r2-smoke-test.ts
 */
import { R2Adapter } from "../core/files/infrastructure/r2-adapter.js";

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

const adapter = new R2Adapter({
  accountId: need("AURIC_R2_ACCOUNT_ID"),
  accessKeyId: need("AURIC_R2_ACCESS_KEY_ID"),
  secretAccessKey: need("AURIC_R2_SECRET_ACCESS_KEY"),
  bucket: need("AURIC_R2_BUCKET"),
  endpoint: process.env.AURIC_R2_ENDPOINT,
});

const key = `smoke/${new Date().toISOString().slice(0, 7)}/probe-${Date.now()}`;
const body = Buffer.from(`r2 smoke test @ ${new Date().toISOString()}\n`);

let failed = false;
const step = async (name: string, fn: () => Promise<void>) => {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed = true;
    console.error(`  ✗ ${name}\n    ${(err as Error).message}`);
  }
};

console.log(`R2 smoke test — bucket=${process.env.AURIC_R2_BUCKET} key=${key}`);

await step("presignPut issues a signed URL", async () => {
  const up = await adapter.presignPut(key, { contentType: "text/plain", expiresIn: 300 });
  if (!/X-Amz-Signature=/.test(up.url)) throw new Error("no signature in URL");
  // Browser-style: raw PUT, no Authorization header.
  const res = await fetch(up.url, {
    method: "PUT",
    body,
    headers: { "Content-Type": "text/plain" },
  });
  if (!res.ok) throw new Error(`PUT ${res.status} ${await res.text()}`);
});

await step("head() sees the uploaded object with the right size", async () => {
  const h = await adapter.head(key);
  if (!h) throw new Error("head returned null");
  if (h.size !== body.byteLength) throw new Error(`size ${h.size} != ${body.byteLength}`);
});

await step("get() returns the exact bytes", async () => {
  const got = await adapter.get(key);
  if (!got.equals(body)) throw new Error(`content mismatch: ${JSON.stringify(got.toString())}`);
});

await step("url() presigned GET is fetchable by a bare client", async () => {
  const url = await adapter.url(key);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${res.status}`);
  const text = await res.text();
  if (text !== body.toString()) throw new Error("presigned GET body mismatch");
});

await step("head() on a missing key returns null", async () => {
  const h = await adapter.head(`${key}-does-not-exist`);
  if (h !== null) throw new Error("expected null");
});

await step("remove() deletes the object", async () => {
  await adapter.remove(key);
  const h = await adapter.head(key);
  if (h !== null) throw new Error("object still present after remove");
});

console.log(failed ? "\nFAILED" : "\nAll R2 checks passed.");
process.exit(failed ? 1 : 0);
