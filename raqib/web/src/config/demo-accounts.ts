/**
 * The seeded demo accounts (backend: raqib/backend/app/raqib/demo/demo-data.ts). Only shown when the app runs in
 * demo mode; each is a real account signing in through the real auth API with the demo password.
 */
export interface DemoAccount {
  email: string;
  label: { ar: string; en: string };
  role: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { email: "s.alotaibi@raqib.sa", role: "qm", label: { ar: "سعود العتيبي — إدارة الجودة", en: "Saud Al-Otaibi — Quality Management" } },
  { email: "n.alqahtani@raqib.sa", role: "qe", label: { ar: "نورة القحطاني — موظف جودة", en: "Noura Al-Qahtani — Quality Employee" } },
  { email: "f.aldosari@raqib.sa", role: "pm", label: { ar: "فهد الدوسري — مدير مشروع", en: "Fahad Al-Dosari — Project Manager" } },
  { email: "k.alshehri@raqib.sa", role: "ins", label: { ar: "خالد الشهري — مفتش (أ)", en: "Khalid Al-Shehri — Inspector A" } },
  { email: "r.alzahrani@raqib.sa", role: "ins", label: { ar: "ريم الزهراني — مفتشة (ب)", en: "Reem Al-Zahrani — Inspector B" } },
  { email: "m.alharbi@raqib.sa", role: "gs", label: { ar: "ماجد الحربي — مشرف حراسات", en: "Majed Al-Harbi — Guards Supervisor" } },
  { email: "g-10302@raqib.sa", role: "guard", label: { ar: "عبدالله المطيري — حارس أمن", en: "Abdullah Al-Mutairi — Security Guard" } },
  { email: "m.alsudairi@raqib.sa", role: "gm", label: { ar: "منصور السديري — المدير العام", en: "Mansour Al-Sudairi — General Manager" } },
];
