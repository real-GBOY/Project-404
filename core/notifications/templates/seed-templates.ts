import type { TemplateSeed } from "../infrastructure/template-repository.js";

/**
 * Default bilingual templates seeded on startup (§7.5 "templated (bilingual)").
 * A client can override any row later; the seed only fills gaps via upsert.
 */
export const seedTemplates: TemplateSeed[] = [
  {
    key: "email_verification",
    locale: "ar",
    channel: "email",
    subject: "تأكيد بريدك الإلكتروني",
    body: "مرحبًا،\n\nفضلًا أكِّد بريدك الإلكتروني عبر الرابط التالي:\n{{link}}\n\nالرابط صالح لمدة 24 ساعة.",
  },
  {
    key: "email_verification",
    locale: "en",
    channel: "email",
    subject: "Confirm your email address",
    body: "Hello,\n\nPlease confirm your email address using the link below:\n{{link}}\n\nThis link is valid for 24 hours.",
  },
  {
    key: "password_reset",
    locale: "ar",
    channel: "email",
    subject: "إعادة تعيين كلمة المرور",
    body: "لقد طلبت إعادة تعيين كلمة المرور.\n\nاستخدم الرابط التالي:\n{{link}}\n\nالرابط صالح لمدة ساعة واحدة. إذا لم تطلب ذلك فتجاهل هذه الرسالة.",
  },
  {
    key: "password_reset",
    locale: "en",
    channel: "email",
    subject: "Reset your password",
    body: "You requested a password reset.\n\nUse the link below:\n{{link}}\n\nThis link is valid for one hour. If you did not request this, ignore this message.",
  },
  {
    key: "welcome",
    locale: "ar",
    channel: "in_app",
    subject: "أهلًا بك في {{app}}",
    body: "تم إنشاء حسابك بنجاح.",
  },
  {
    key: "welcome",
    locale: "en",
    channel: "in_app",
    subject: "Welcome to {{app}}",
    body: "Your account has been created successfully.",
  },
];
