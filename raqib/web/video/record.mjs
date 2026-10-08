// Records the Arabic walkthrough video of Raqib: the real system, driven in a real browser, with Arabic captions.
//   node video/record.mjs <outDir> [--dry]      (--dry: fast, no pauses, screenshots at each scene instead of a long recording)
// Needs the throw-away stack from video/README.md (backend :3399 seeded with the demo company, web :4599 built with VITE_DEMO_SCOPE=client).
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { OVERLAY } from "./overlay.mjs";
import { ar, S } from "./ar.mjs";

const OUT = process.argv[2] ?? "video-out";
const DRY = process.argv.includes("--dry");
const WEB = "http://localhost:4599";
const API = "http://localhost:3399/api";
const PW = "demo-password-2026";
const ACCT = {
  qm: ["s.alotaibi@raqib.sa", /سعود العتيبي/],
  qe: ["n.alqahtani@raqib.sa", /نورة القحطاني/],
  ins: ["k.alshehri@raqib.sa", /خالد الشهري/],
};
const K = DRY ? 0.2 : 1; // pause scale
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  locale: "ar-SA",
  ...(DRY ? {} : { recordVideo: { dir: OUT, size: { width: 1280, height: 720 } } }),
});
await ctx.addInitScript(OVERLAY);
await ctx.addInitScript(() => localStorage.setItem("raqib.lang", "ar"));
const page = await ctx.newPage();
await page.route("**/api/**", (r) =>
  r.continue({ headers: { ...r.request().headers(), "x-forwarded-for": "10.88.1.1" } }),
);

page.on("response", async (r) => {
  if (r.url().includes("/api/") && r.status() >= 400 && r.request().method() !== "GET")
    console.log(
      "API",
      r.status(),
      r.request().method(),
      r.url().replace(/^.*\/api/, ""),
      (await r.text().catch(() => "")).slice(0, 160),
    );
});
// ── tiny toolkit ─────────────────────────────────────────────────────────────
const sleep = (ms) => page.waitForTimeout(Math.max(DRY ? 220 : 40, ms * K));
const call = (fn, arg) => page.evaluate(({ fn, arg }) => window.__rq[fn](arg), { fn, arg });
const reading = (t) => Math.max(3400, 1500 + t.length * 52);
const TOTAL = 9;
let chapter = { n: 0, name: "" };
let shot = 0;
const snap = async (name) => {
  if (DRY) await page.screenshot({ path: `${OUT}/${String(++shot).padStart(2, "0")}-${name}.png` });
};

async function caption(title, text, extra = {}) {
  await call("cap", {
    badge: `${chapter.n} / ${TOTAL} · ${chapter.name}`,
    title,
    text,
    p: chapter.n / TOTAL,
    ...extra,
  });
}
/** Show a caption, run the actions meanwhile, and keep the caption up long enough to be read. */
async function say(title, text, fn, opt) {
  const { min, side } = typeof opt === "object" ? opt : { min: opt };
  const t0 = Date.now();
  await caption(title, text, { side: !!side });
  if (fn) await fn();
  const left = (min ?? reading(text)) * K - (Date.now() - t0);
  if (left > 0) await page.waitForTimeout(left);
}
async function card(o, ms) {
  await call("card", o);
  await sleep(ms ?? 5200);
}
async function hideCard() {
  await call("card", null);
  await sleep(700);
}
async function startChapter(n, name, card_) {
  chapter = { n, name };
  if (card_) {
    await card({ ...card_, kicker: `الفصل ${n} من ${TOTAL}` }, card_.ms ?? 4200);
    await hideCard();
  }
}
async function place(loc, block = "center") {
  await loc.evaluate((el, b) => el.scrollIntoView({ block: b, inline: "nearest" }), block);
  await sleep(250);
  return loc.boundingBox();
}
async function ring(loc, ms = 900) {
  const b = await place(loc);
  if (!b) return null;
  await call("ring", { x: b.x, y: b.y, w: b.width, h: b.height });
  await sleep(ms);
  return b;
}
async function unring() {
  await call("ring", null);
}
async function glide(x, y, steps = 24) {
  await page.mouse.move(x, y, { steps: DRY ? 3 : steps });
}
/** Move the visible cursor to the element, ring it, click it. */
async function tap(loc, { pause = 450, then = 600 } = {}) {
  const b = await place(loc);
  if (!b) throw new Error("not visible: " + loc);
  const x = b.x + b.width / 2,
    y = b.y + b.height / 2;
  await call("ring", { x: b.x, y: b.y, w: b.width, h: b.height });
  await glide(x, y);
  await sleep(pause);
  await call("ripple", { x, y });
  await page.mouse.click(x, y);
  await call("ring", null);
  await sleep(then);
}
async function point(loc, ms = 1400) {
  // hover + ring without clicking
  const b = await place(loc);
  if (!b) return;
  await call("ring", { x: b.x, y: b.y, w: b.width, h: b.height });
  await glide(b.x + b.width / 2, b.y + b.height / 2);
  await sleep(ms);
  await unring();
}
async function typeIn(loc, text, delay = 55) {
  await tap(loc, { then: 200 });
  await page.keyboard.type(text, { delay: DRY ? 0 : delay });
  await sleep(500);
}
const side = (name) => page.locator("aside").getByRole("button", { name, exact: true });
const dlg = () => page.getByRole("dialog");
const btn = (name, o = {}) => page.getByRole("button", { name, ...o });
async function nav(name) {
  await tap(side(name), { then: 1800 });
}
async function waitStable(ms = 1600) {
  await sleep(ms);
}

// ── API helpers (set-up only; never shown) ───────────────────────────────────
async function api(email) {
  const H = { "content-type": "application/json", "x-forwarded-for": "10.88.2.2" };
  const r = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ email, password: PW }),
  });
  const t = (await r.json()).tokens.accessToken;
  const A = { ...H, authorization: `Bearer ${t}` };
  return async (method, path, body) =>
    (
      await fetch(API + path, { method, headers: A, body: body ? JSON.stringify(body) : undefined })
    ).json();
}
/** A believable site photo for the evidence step (drawn in the page, so no image file is needed). */
async function sitePhoto() {
  const b64 = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 720;
    c.height = 440;
    const g = c.getContext("2d");
    const sky = g.createLinearGradient(0, 0, 0, 440);
    sky.addColorStop(0, "#9ec3d6");
    sky.addColorStop(1, "#e7eef0");
    g.fillStyle = sky;
    g.fillRect(0, 0, 720, 440);
    g.fillStyle = "#6b7a73";
    g.fillRect(0, 300, 720, 140);
    g.fillStyle = "#c9c2b0";
    g.fillRect(70, 110, 580, 190);
    g.fillStyle = "#4b5a54";
    g.fillRect(70, 100, 580, 22);
    for (let i = 0; i < 9; i++) {
      g.fillStyle = "#334";
      g.fillRect(100 + i * 60, 140, 34, 160);
    }
    g.fillStyle = "#b8332b";
    g.fillRect(300, 250, 120, 50);
    g.fillStyle = "rgba(255,255,255,.9)";
    g.fillRect(14, 14, 190, 30);
    g.fillStyle = "#222";
    g.font = "bold 16px sans-serif";
    g.fillText("08/10/2026  09:42  GPS ✓", 22, 35);
    return c.toDataURL("image/png").split(",")[1];
  });
  return Buffer.from(b64, "base64");
}
/** The report is issued a moment after approval: wait until it exists, so the list shows it when we open it. */
async function waitForReport(ref) {
  const qm = await api(ACCT.qm[0]);
  for (let i = 0; i < 40; i++) {
    const vs = (await qm("GET", "/raqib/visits?limit=500")).items;
    const v = vs.find((x) => x.ref === ref);
    const rs = (await qm("GET", "/raqib/reports?limit=500")).items;
    if (v && rs.some((r) => r.visitId === v.id)) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("report for " + ref + " was never issued");
}
async function switchTo(key) {
  // the demo-account switcher on "My settings" (a real sign-in)
  const me = ACCT[key];
  await tap(side("إعداداتي"), { then: 1500 });
  const sel = page.getByLabel(S("acct_demoLabel"));
  await ring(sel, 800);
  await sel.selectOption(me[0]);
  await unring();
  await waitStable(2800);
}

try {
  // ═════ 0 · title ═════════════════════════════════════════════════════════════
  await page.goto(WEB + "/");
  await sleep(1200);
  await card(
    {
      logo: true,
      title: "رقيب — دليل الاستخدام المصوّر",
      sub: "منصة إدارة الجودة والتفتيش الميداني الأمني: من جدولة الزيارة إلى التقرير والإجراء التصحيحي",
      bullets: [
        "جدولة الزيارات وإدارتها",
        "تنفيذ التفتيش من الهاتف حتى دون اتصال",
        "المراجعة والاعتماد وإصدار التقرير",
        "الملاحظات والإجراءات التصحيحية",
        "مؤشرات الأداء والتحليلات",
      ],
      wide: true,
    },
    8500,
  );
  await hideCard();

  // ═════ 1 · who is who + sign in ═════════════════════════════════════════════
  await startChapter(1, "الأدوار وتسجيل الدخول", {
    title: "لكل شخص ما يخصّه فقط",
    sub: "يرى كل مستخدم الشاشات والبيانات التي تسمح بها صلاحياته ونطاقه",
    bullets: [
      "مدير الجودة: يتابع كل شيء ويعتمد",
      "مهندس الجودة: يراجع ويحيل للاعتماد",
      "المفتش: ينفّذ الزيارات الميدانية",
      "مدير المشروع والإدارة العليا: يتابعون الأداء",
    ],
    ms: 6500,
  });
  await say(
    "شاشة الدخول",
    "يدخل المستخدم بالبريد وكلمة المرور، ويمكن تفعيل التحقق بخطوتين. في هذا العرض التجريبي تظهر حسابات جاهزة لتجربة كل دور بنقرة واحدة.",
    async () => {
      await sleep(1200);
      await snap("login");
    },
  );
  await say(
    "نبدأ بمدير الجودة",
    "سنختار حساب مدير الجودة لنرى الصورة الكاملة، ثم ننتقل إلى المفتش في الميدان.",
    async () => {
      await tap(btn(ACCT.qm[1]));
      await waitStable(3200);
    },
  );

  // ═════ 2 · overview, search, bell ═══════════════════════════════════════════
  await startChapter(2, "الصفحة الرئيسية");
  await snap("overview");
  await say(
    "نظرة عامة على العمل",
    "بطاقات الأعلى تُنبّه إلى ما يحتاج تدخّلًا: تفتيشات تنتظر المراجعة، وزيارات وإجراءات متأخرة. الأرقام تتحدّث تلقائيًا.",
    async () => {
      await glide(520, 210);
      await sleep(1500);
    },
  );
  await say(
    "نسبة الامتثال لكل مشروع",
    "الجدول يعرض نسبة الامتثال لكل مشروع وتغيّرها عن الفترة السابقة، مع الملاحظات المفتوحة وموعد الزيارة القادمة. يمكنك تبديل الفترة: الأسبوع أو الشهر أو الربع.",
    async () => {
      await tap(btn("هذا الربع"));
      await sleep(1500);
      await tap(btn("هذا الشهر"));
    },
  );
  await say(
    "البحث السريع",
    "اضغط Ctrl + K أو اضغط مربع البحث، واكتب اسم مشروع أو موقع أو رقم زيارة. تنقّل بين النتائج بالسهمين ↑ ↓ ثم Enter لفتح النتيجة.",
    async () => {
      await tap(page.getByRole("button", { name: /ابحث بالاسم/ }));
      const box = page.getByRole("combobox");
      await sleep(500);
      await page.keyboard.type("الواحة", { delay: DRY ? 0 : 140 });
      await sleep(2600);
      await snap("search");
      await page.keyboard.press("ArrowDown");
      await sleep(700);
      await page.keyboard.press("ArrowDown");
      await sleep(700);
      await page.keyboard.press("ArrowUp");
      await sleep(1100);
      await page.keyboard.press("Escape");
      await sleep(700);
    },
    8500,
  );

  // ═════ 3 · visits ═══════════════════════════════════════════════════════════
  await startChapter(3, "جدول الزيارات", {
    title: "جدولة الزيارات",
    sub: "الخطوة الأولى في رحلة التفتيش: متى، وأين، ومن سيزور؟",
    ms: 4200,
  });
  await nav("جدول الزيارات");
  await snap("visits-list");
  await say(
    "القائمة وحالات الزيارة",
    "كل زيارة لها رقم مرجعي وحالة: قادمة، قيد التنفيذ، بانتظار القرار، معادة، متأخرة، مغلقة. اضغط أي حالة لتصفية القائمة.",
    async () => {
      await tap(page.getByRole("button", { name: /^قادمة/ }));
      await sleep(1500);
      await tap(page.getByRole("button", { name: /^متأخرة/ }));
      await sleep(1500);
      await tap(page.getByRole("button", { name: /^الكل/ }));
    },
  );
  await say(
    "عرض الأسبوع",
    "بدّل إلى عرض «أسبوع» لترى زيارات الأيام السبعة القادمة موزّعة على التقويم، ولكل زيارة لون يدل على حالتها.",
    async () => {
      await tap(btn("أسبوع"));
      await sleep(1200);
      await snap("week");
    },
  );
  await say(
    "اسحب لتغيير الموعد",
    "لتغيير موعد زيارة اسحبها وأفلتها على يوم آخر. يفتح النظام نافذة تطلب سبب التغيير، ويُسجَّل السبب في سجل الزيارة ويُبلَّغ المفتش.",
    async () => {
      const card_ = page
        .locator('[data-visit][draggable="true"]')
        .filter({ hasText: /الشاحنات|البرج/ })
        .first();
      const from = await card_.locator("xpath=ancestor::*[@data-day]").getAttribute("data-day");
      const days = await page
        .locator("[data-day]")
        .evaluateAll((e) => e.map((x) => x.getAttribute("data-day")));
      const to = days[Math.min(days.indexOf(from) + 2, days.length - 1)];
      const b = await place(card_);
      await call("ring", { x: b.x, y: b.y, w: b.width, h: b.height });
      await glide(b.x + b.width / 2, b.y + 18);
      await sleep(700);
      await call("ring", null);
      await page.mouse.down();
      await sleep(250);
      const tb = await page.locator(`[data-day="${to}"]`).boundingBox();
      await page.mouse.move(b.x + b.width / 2 - 40, b.y + 60, { steps: 6 });
      await page.mouse.move(tb.x + tb.width / 2, tb.y + 140, { steps: DRY ? 4 : 34 });
      await sleep(900);
      await snap("dragging");
      await page.mouse.up();
      await sleep(1300);
    },
    8500,
  );
  await say(
    "سبب إعادة الجدولة مطلوب",
    "اكتب السبب ثم احفظ. هذا يحافظ على سجل واضح: من غيّر الموعد، ومتى، ولماذا.",
    async () => {
      await point(dlg(), 800);
      await typeIn(
        dlg().getByLabel(/السبب/),
        "تعارض مع جدول المناوبات؛ نُقلت الزيارة ليومين لاحقًا",
      );
      await snap("resched");
      await tap(dlg().getByRole("button", { name: S("m_resched_ok") }));
      await dlg().waitFor({ state: "hidden" });
      await sleep(1800);
    },
    { side: true, min: 6500 },
  );
  await say(
    "إنشاء زيارة جديدة",
    "اضغط «زيارة جديدة»، اختر المشروع والموقع والمفتش ونوع الزيارة والوردية، واكتب سبب الجدولة.",
    async () => {
      await tap(btn("زيارة جديدة"));
      const d = dlg();
      const pick = async (label, index) => {
        const s = d.getByLabel(label);
        await ring(s, 500);
        await s.selectOption({ index });
        await unring();
        await sleep(500);
      };
      await pick("المشروع", 1);
      await pick("الموقع", 1);
      await sleep(600);
      {
        // the area: one of the site's listed areas, or free text when the site has none
        const areaSel = d.getByLabel(/^المنطقة/);
        await ring(areaSel, 500);
        const opts = await areaSel
          .locator("option")
          .evaluateAll((o) => o.map((x) => ({ v: x.value, t: x.textContent })));
        const real = opts.find((o) => o.v && !/أخرى/.test(o.t));
        if (real) await areaSel.selectOption(real.v);
        await unring();
        if (!real)
          await typeIn(
            d.getByPlaceholder ? d.locator("input[type=text]").first() : areaSel,
            "المدخل الرئيسي",
          );
        await sleep(500);
      }
      await pick("نوع الزيارة", 0);
      const insSel = d.getByLabel("المفتش");
      await ring(insSel, 500);
      const n = await insSel.locator("option").count();
      if (n > 1) await insSel.selectOption({ index: 1 });
      await unring();
      await typeIn(d.getByLabel(/سبب الجدولة/), "جولة دورية ضمن الخطة الشهرية");
      await snap("newvisit");
    },
    { side: true, min: 9000 },
  );
  await say(
    "إنشاء وإسناد",
    "بعد الحفظ تظهر الزيارة في الجدول برقمها المرجعي، ويصل المفتش إشعار فوري بها.",
    async () => {
      await tap(dlg().getByRole("button", { name: S("m_create_ok") }));
      await dlg().waitFor({ state: "hidden" });
      await sleep(2200);
      await snap("created");
    },
    { side: true },
  );

  // ═════ 4 · inspector in the field ═══════════════════════════════════════════
  await startChapter(4, "التفتيش الميداني", {
    title: "التفتيش في الميدان",
    sub: "المفتش ينفّذ الزيارة من هاتفه أو حاسوبه: بنود، ملاحظات، وأدلة بالصور",
    ms: 4800,
  });
  await say(
    "ننتقل إلى حساب المفتش",
    "من «إعداداتي» يمكنك في العرض التجريبي تبديل الحساب بسرعة. في الواقع يدخل كل شخص بحسابه.",
    async () => {
      await switchTo("ins");
    },
  );
  await say(
    "يومي: زيارات اليوم",
    "تبدأ شاشة المفتش بزيارات اليوم: الوقت والموقع والوردية، وزر واضح لبدء التفتيش أو متابعته، مع الزيارات القادمة أسفلها.",
    async () => {
      await nav("يومي");
      await snap("ins-home");
      await sleep(1200);
    },
  );
  await say(
    "بدء التفتيش",
    "اضغط «بدء التفتيش». يثبّت النظام نسخة نموذج التفتيش وقت البدء، فلا يتأثر عملك بأي تعديل لاحق على النموذج.",
    async () => {
      await tap(btn("بدء التفتيش", { exact: true }).first(), { then: 2600 });
      await snap("workspace");
    },
  );
  const photo = await sitePhoto();
  await say(
    "الإجابة على البنود",
    "لكل بند ثلاث إجابات: مطابق، غير مطابق، لا ينطبق. يُحفظ كل اختيار تلقائيًا، وشريط التقدم أعلى الصفحة يوضح ما أُنجز.",
    async () => {
      await tap(btn("مطابق", { exact: true }).nth(0));
      await sleep(500);
      await tap(btn("غير مطابق", { exact: true }).nth(1), { then: 900 });
      await snap("answers");
    },
  );
  await say(
    "عند عدم المطابقة: ملاحظة ودليل",
    "اكتب ما لاحظته وأرفق صورة. الدليل مطلوب لكل بند غير مطابق، ويُحفظ ختم الوقت مع الصورة لتوثيق الواقعة.",
    async () => {
      const note = page.locator("textarea").first();
      if (await note.isVisible().catch(() => false))
        await typeIn(note, "دخل زائران دون إبراز الهوية خلال 20 دقيقة من المراقبة");
      const upload = btn(/رفع صورة أو فيديو/).first();
      const [chooser] = await Promise.all([
        page.waitForEvent("filechooser"),
        tap(upload, { then: 300 }),
      ]);
      await chooser.setFiles({ name: "gate.png", mimeType: "image/png", buffer: photo });
      await sleep(3000);
      await snap("evidence");
    },
    8500,
  );
  await say(
    "بقية البنود والأقسام",
    "أكمل البنود، ثم انتقل بزر «القسم التالي» أو من قائمة الأقسام على الجانب. الدائرة الخضراء تعني أن القسم اكتمل.",
    async () => {
      await tap(btn("مطابق", { exact: true }).nth(2));
      await sleep(500);
      await tap(btn("لا ينطبق", { exact: true }).nth(3));
      await tap(btn("القسم التالي", { exact: false }), { then: 1500 });
    },
  );

  // finish the rest quietly (set-up) so the video can show the last two steps
  {
    const ins = await api(ACCT.ins[0]);
    const list = (await ins("GET", "/raqib/visits?limit=500")).items;
    const v = list.find((x) => x.ref === "VIS-26-0002");
    const view = await ins("GET", `/raqib/visits/${v.id}/inspection`);
    for (const it of view.sections.flatMap((s) => s.items))
      if (!it.answer)
        await ins("PUT", `/raqib/visits/${v.id}/inspection/answers/${it.id}`, { value: "c" });
    for (const g of view.guards)
      for (const c of view.guardCriteria)
        await ins("PUT", `/raqib/visits/${v.id}/inspection/guards/${g.guardId}/scores/${c.id}`, {
          score: 4,
        });
    await page.goto(`${WEB}/inspect/${v.id}`);
    await sleep(2500);
  }
  await say(
    "تقييم الحراس",
    "في آخر الأقسام يقيّم المفتش حراس الموقع وفق معايير محددة، فتُحسب درجة كل حارس تلقائيًا.",
    async () => {
      await tap(btn(/تقييم الحراس/), { then: 1800 });
      await snap("guards");
    },
  );
  await say(
    "المراجعة والإرسال",
    "الملخص يعرض الدرجة وعدد البنود المطابقة وغير المطابقة والأدلة. إذا بقي شيء ناقص يُنبّهك النظام قبل الإرسال.",
    async () => {
      await tap(btn(/المراجعة والإرسال/), { then: 1600 });
      await snap("submit-step");
    },
  );
  await say(
    "الإقرار والإرسال",
    "أقرّ بصحة النتائج ثم اضغط «إرسال للمراجعة». تنتقل الزيارة إلى فريق الجودة ولا يمكن تعديلها بعد ذلك إلا بإعادتها.",
    async () => {
      await tap(page.getByRole("checkbox"));
      await sleep(600);
      await tap(btn("إرسال للمراجعة"), { then: 900 });
      await snap("submit-confirm");
      await tap(dlg().getByRole("button", { name: "إرسال", exact: true }), { then: 600 });
      await dlg().waitFor({ state: "hidden" });
      await sleep(2400);
      await snap("submitted");
    },
  );
  await say(
    "يعمل دون اتصال",
    "إذا انقطعت الشبكة في الموقع، يواصل المفتش العمل وتُحفظ إجاباته وصوره على الجهاز، ثم تُرسل تلقائيًا عند عودة الاتصال.",
    async () => {
      await sleep(300);
    },
    6200,
  );

  // ═════ 5 · review & approval ════════════════════════════════════════════════
  await startChapter(5, "المراجعة والاعتماد", {
    title: "المراجعة ثم الاعتماد",
    sub: "كل تفتيش يمر على موظف جودة ثم على المدير قبل أن يصبح تقريرًا رسميًا",
    ms: 5200,
  });
  await say(
    "مهندس الجودة يراجع",
    "ننتقل إلى حساب مهندس الجودة. أي تفتيش مُرسل يظهر في «المراجعة والاعتماد» بانتظار قراره.",
    async () => {
      await page.goto(WEB + "/overview");
      await sleep(2200);
      await switchTo("qe");
      await nav("المراجعة والاعتماد");
      await snap("review-list");
    },
  );
  await say(
    "تفاصيل التفتيش",
    "ترى الدرجة والبنود وملاحظات المفتش والأدلة. يمكنك طلب تعديل بند محدد، أو إعادة التفتيش للاستكمال، أو الرفض، أو الإحالة للاعتماد.",
    async () => {
      await tap(page.getByText("VIS-26-0002").first(), { then: 2400 });
      await snap("review-detail");
      await glide(300, 400);
      await sleep(1500);
    },
    8500,
  );
  await say(
    "إحالة للاعتماد",
    "عند الاطمئنان إلى النتائج يحيل مهندس الجودة التفتيش إلى المدير. يُسجَّل قراره باسمه ووقته.",
    async () => {
      await tap(btn(S("forwardApproval")));
      await sleep(900);
      await tap(dlg().getByRole("button", { name: S("m_forward_ok"), exact: true }), { then: 600 });
      await dlg().waitFor({ state: "hidden" });
      await sleep(1800);
      await snap("forwarded");
    },
    { side: true },
  );
  await say(
    "مدير الجودة يعتمد",
    "ننتقل إلى مدير الجودة. «اعتماد وإصدار التقرير» هو القرار النهائي: يُغلق التفتيش ويُنشأ التقرير الرسمي تلقائيًا.",
    async () => {
      await switchTo("qm");
      await nav("المراجعة والاعتماد");
      await tap(page.getByText("VIS-26-0002").first(), { then: 2200 });
      await tap(btn(ar("Approve & issue report")));
      await sleep(900);
      await snap("approve-dialog");
      await tap(dlg().getByRole("button", { name: S("m_approve_ok"), exact: true }), { then: 600 });
      await dlg().waitFor({ state: "hidden" });
      await sleep(2200);
      await snap("approved");
    },
    { side: true, min: 9000 },
  );

  // ═════ 6 · reports ══════════════════════════════════════════════════════════
  await startChapter(6, "التقارير", {
    title: "التقرير الرسمي",
    sub: "يُنشأ من نسخة مجمّدة من التفتيش، فلا يتغير مضمونه بعد الاعتماد",
    ms: 4600,
  });
  await say(
    "مركز التقارير",
    "كل التقارير المعتمدة في مكان واحد، لكل تقرير رقمه ودرجته وزر «عرض» وزر PDF. التقرير الذي اعتمدناه للتو موجود ضمن القائمة.",
    async () => {
      await waitForReport("VIS-26-0002");
      await nav("التقارير");
      await snap("reports");
      await sleep(1500);
    },
  );
  await say(
    "فتح التقرير وتنزيله PDF",
    "افتح التقرير لتراه مرتبًا للطباعة: الدرجة والنتائج والأدلة والتوقيعات. بدّل لغة التقرير بين العربية والإنجليزية، ثم «تنزيل PDF» لمشاركته.",
    async () => {
      const open = page
        .locator(
          "xpath=//button[normalize-space(.)='عرض'][parent::div[contains(., 'VIS-26-0002')]]",
        )
        .first();
      await point(open.locator(".."), 1500);
      await tap(open, { then: 2400 });
      await tap(btn("العربية", { exact: true }), { then: 2200 });
      await snap("report");
      await point(btn(/تنزيل PDF/), 1600);
      await glide(640, 360);
      await sleep(1500);
    },
    8000,
  );

  // ═════ 7 · observations & corrective actions ════════════════════════════════
  await startChapter(7, "الملاحظات والإجراءات التصحيحية", {
    title: "من الملاحظة إلى الإغلاق",
    sub: "كل مخالفة تتحول إلى إجراء تصحيحي له مسؤول وموعد وأدلة وقرار جودة",
    ms: 5200,
  });
  await say(
    "الملاحظات والمخالفات",
    "كل بند غير مطابق وكل ملاحظة ميدانية تُسجَّل هنا، مع المشروع والموقع والأولوية. يمكن أيضًا تسجيل ملاحظة جديدة مباشرة.",
    async () => {
      await nav("الملاحظات والمخالفات");
      await snap("observations");
      await sleep(1200);
    },
  );
  await say(
    "الإجراءات التصحيحية",
    "من الملاحظة يُنشأ إجراء يُسند لمسؤول بموعد استحقاق. القائمة تُظهر المتأخر والمعاد والمغلق بوضوح.",
    async () => {
      await nav("الإجراءات التصحيحية");
      await snap("actions");
      await sleep(1200);
    },
  );
  await say(
    "مسار الإجراء",
    "الخط الزمني يتتبّع الإجراء خطوة بخطوة: تسجيل، إسناد، تنفيذ، أدلة الإغلاق، تسليم للمراجعة، قرار الجودة ثم الإغلاق. وإن لم تكفِ الأدلة يُعاد للمسؤول.",
    async () => {
      const row = page.getByText("CA-26-0006").first();
      if (await row.isVisible().catch(() => false)) await tap(row, { then: 2400 });
      await snap("action-detail");
      await glide(520, 360);
      await sleep(1500);
    },
    9000,
  );

  // ═════ 8 · analytics & forms ════════════════════════════════════════════════
  await startChapter(8, "التحليلات ونماذج التفتيش", {
    title: "قياس الأداء وضبط النماذج",
    sub: "قرارات مبنية على أرقام، ونماذج تفتيش تعدّلها بنفسك",
    ms: 4600,
  });
  await say(
    "التحليلات",
    "مؤشرات الامتثال والاتجاهات والمقارنة بين المشاريع. اختر فترة مخصصة أو جاهزة، وصدّر النتائج إلى CSV أو Excel.",
    async () => {
      await nav("التحليلات");
      await snap("analytics");
      await sleep(1500);
      await page.mouse.wheel(0, 500);
      await sleep(1600);
    },
  );
  await say(
    "نماذج التفتيش",
    "أنشئ نموذجًا بأقسام وبنود وأوزان، وانشر نسخة جديدة. الزيارات الجارية تحتفظ بالنسخة التي بدأت بها.",
    async () => {
      await nav("نماذج التفتيش");
      await snap("forms");
      await sleep(1500);
    },
  );

  // ═════ 9 · settings & close ═════════════════════════════════════════════════
  await startChapter(9, "إعداداتي", {
    title: "حسابك وأمانك",
    sub: "اللغة، التحقق بخطوتين، كلمة المرور، والجلسات",
    ms: 3800,
  });
  await say(
    "إعدادات الحساب",
    "من «إعداداتي» غيّر اللغة بين العربية والإنجليزية، وفعّل التحقق بخطوتين، وغيّر كلمة المرور، وأنهِ الجلسات الأخرى عند الحاجة.",
    async () => {
      await nav("إعداداتي");
      await snap("settings");
      await sleep(1500);
    },
  );

  await chapterEnd();
} catch (e) {
  await page.screenshot({ path: `${OUT}/FAILED.png` }).catch(() => {});
  console.error(
    "DIALOG:",
    (
      await dlg()
        .innerText({ timeout: 2000 })
        .catch(() => "(none)")
    )
      .split(String.fromCharCode(10))
      .join(" | ")
      .slice(0, 700),
  );
  console.error("FAILED:", e.message);
  await ctx.close();
  await browser.close();
  process.exit(1);
}

async function chapterEnd() {
  chapter = { n: TOTAL, name: "الخلاصة" };
  await card(
    {
      logo: true,
      kicker: "الخلاصة",
      title: "رحلة العمل في رقيب",
      sub: "جدولة ← تنفيذ ميداني ← مراجعة ← اعتماد ← تقرير ← إجراء تصحيحي ← تحليل",
      bullets: [
        "اسحب الزيارة لتغيير موعدها",
        "اضغط Ctrl + K للبحث السريع",
        "كل خطوة مسجّلة باسم صاحبها ووقتها",
        "التفتيش يعمل دون اتصال ويُزامَن لاحقًا",
      ],
      wide: true,
    },
    9000,
  );
  await page.waitForTimeout(600);
}
const video = page.video();
await ctx.close();
await browser.close();
if (video) console.log("VIDEO:", await video.path());
