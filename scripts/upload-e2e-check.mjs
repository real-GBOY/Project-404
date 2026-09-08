/**
 * End-to-end check of the presigned document-upload flow against a running API.
 *
 * Logs in, creates a document via the presigned path, PUTs the bytes to the
 * upload URL the API returns (an R2 presigned URL, or the local driver's
 * loopback route), confirms, downloads and byte-compares, then deletes.
 *
 *   API_BASE=https://13-220-157-42.sslip.io/api \
 *   LOGIN_EMAIL=mahmoud.nayel@tawfikpartners.eg LOGIN_PASSWORD=demo-password-2026 \
 *   node scripts/upload-e2e-check.mjs
 *
 * Node 18+ (global fetch). No dependencies.
 */
const API_BASE = (process.env.API_BASE ?? "https://13-220-157-42.sslip.io/api").replace(/\/$/, "");
const EMAIL = process.env.LOGIN_EMAIL;
const PASSWORD = process.env.LOGIN_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error("set LOGIN_EMAIL and LOGIN_PASSWORD");
  process.exit(2);
}

const ok = (m) => console.log(`  ✓ ${m}`);
const die = (m, extra) => {
  console.error(`  ✗ ${m}${extra ? `\n    ${extra}` : ""}`);
  process.exit(1);
};

const payload = Buffer.from(`upload-e2e-check ${new Date().toISOString()} ${Math.random()}\n`);

console.log(`API: ${API_BASE}`);

// 1. login
const loginRes = await fetch(`${API_BASE}/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
if (!loginRes.ok) die(`login ${loginRes.status}`, await loginRes.text());
const token = (await loginRes.json())?.tokens?.accessToken;
if (!token) die("no access token in login response");
ok("logged in");
const auth = { Authorization: `Bearer ${token}` };

// 2. presigned create
const createRes = await fetch(`${API_BASE}/documents`, {
  method: "POST",
  headers: { ...auth, "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "upload-e2e-check.txt",
    category: "Other",
    contentType: "text/plain",
    byteSize: payload.byteLength,
  }),
});
if (!createRes.ok) die(`create ${createRes.status}`, await createRes.text());
const created = await createRes.json();
const docId = created?.document?.id ?? created?.id;
const upload = created?.upload;
if (!docId || !upload?.url)
  die("create response missing document.id / upload.url", JSON.stringify(created));

const absolute = /^https?:\/\//i.test(upload.url);
const putUrl = absolute ? upload.url : `${API_BASE.replace(/\/api$/, "")}${upload.url}`;
ok(`presigned create → doc ${docId} (${absolute ? "R2 presigned URL" : "local loopback"})`);

// 3. PUT the bytes — mirror the web client: no bearer for the absolute (R2) URL
const putHeaders = absolute
  ? { "Content-Type": "text/plain" }
  : { ...auth, "Content-Type": "application/octet-stream" };
const putRes = await fetch(putUrl, {
  method: upload.method ?? "PUT",
  headers: putHeaders,
  body: payload,
});
if (![200, 204].includes(putRes.status)) die(`upload PUT ${putRes.status}`, await putRes.text());
ok(`uploaded ${payload.byteLength} bytes → ${putRes.status}`);

// 4. confirm
const confirmRes = await fetch(`${API_BASE}/documents/${docId}/confirm`, {
  method: "POST",
  headers: auth,
});
if (!confirmRes.ok) die(`confirm ${confirmRes.status}`, await confirmRes.text());
ok("confirmed");

// 5. download + verify
const dlRes = await fetch(`${API_BASE}/documents/${docId}/download`, { headers: auth });
if (!dlRes.ok) die(`download ${dlRes.status}`, await dlRes.text());
const got = Buffer.from(await dlRes.arrayBuffer());
if (!got.equals(payload)) die(`downloaded bytes differ (${got.length}b vs ${payload.length}b)`);
ok("downloaded bytes match");

// 6. cleanup
const delRes = await fetch(`${API_BASE}/documents/${docId}`, { method: "DELETE", headers: auth });
if (![200, 204].includes(delRes.status)) die(`delete ${delRes.status}`, await delRes.text());
ok("deleted");

console.log("\nAll good — the presigned upload flow works end to end.");
