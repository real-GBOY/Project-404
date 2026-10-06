import { ApiError } from "@/services/http";
import type { Ctx } from "../context";
import { HANDLERS } from "./handlers";
import { missingFields } from "./validation";

/** Validate locally (UX), then send the command; the backend remains the authority and may still refuse. */
export async function submitModal(c: Ctx): Promise<void> {
  const m = c.ui.modal;
  if (!m) return;
  const f = c.ui.mf;
  const missing = missingFields(m.kind, f);
  if (missing.length) {
    c.set({ mErr: missing });
    return;
  }
  c.set({ busy: true });
  try {
    await HANDLERS[m.kind]?.({ c, m, f, reason: String(f.reason ?? "").trim() });
    c.set({ modal: null, busy: false });
  } catch (e) {
    c.set({ busy: false });
    c.toast(e instanceof ApiError ? e.message : c.i.S("actionFailed"));
  }
}
