/** Translation table [ar, en] - working without a connection. */
export const STRINGS_OFFLINE: Record<string, readonly [string, string]> = {
  off_offline: ["غير متصل", "Offline"],
  off_waiting: ["{n} تغيير بانتظار الإرسال", "{n} change(s) waiting to send"],
  off_syncing: ["جارٍ المزامنة…", "Syncing…"],
  off_failed: ["تعذر حفظ {n} تغيير", "{n} change(s) could not be saved"],
  off_discard: ["تجاهل", "Discard"],
  off_discardAll: ["تجاهل الكل", "Discard all"],
  off_k_answer: ["إجابة", "Answer"],
  off_k_guardScore: ["تقييم حارس", "Guard score"],
  off_k_guardNote: ["ملاحظة حارس", "Guard note"],
  off_k_evidence: ["دليل", "Evidence"],
  off_k_submit: ["إرسال التفتيش", "Inspection submission"],
  off_submitQueued: [
    "حُفظ إرسال {r} على هذا الجهاز وسيُرسل عند عودة الاتصال.",
    "Submission of {r} is saved on this device and will be sent when the connection returns.",
  ],
  off_signInNeedsConnection: ['أنت غير متصل. يلزم الاتصال بالإنترنت لتسجيل الدخول.', 'You are offline. Signing in needs a connection.'],
  off_needsConnection: [
    "بدء التفتيش يتطلب اتصالًا بالإنترنت.",
    "Starting an inspection needs a connection.",
  ],
};
