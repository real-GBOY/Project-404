import { useI18n } from "@/hooks/use-i18n";
import { C } from "@/styles/colors";
import { FORM } from "@/styles/form-styles";
import type { FormField } from "@/ui/form-field";

/** The inputs of a data-entry dialog, laid out two to a row where a field is marked `half`. */
export function ModalForm({ fields }: { fields: FormField[] }) {
  const { lang } = useI18n();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
      {fields.map((f) => (
        <div
          key={f.key}
          style={{ ...FORM.label, flex: f.half ? "1 1 200px" : "1 1 100%", minWidth: 0 }}
        >
          <label style={FORM.label}>
            {f.label}
            {f.type === "select" ? (
              <select
                value={f.val}
                onChange={f.on}
                aria-label={f.label}
                aria-invalid={f.err}
                style={{
                  ...FORM.input,
                  height: 40,
                  background: C.surface.white,
                  borderColor: f.bd,
                }}
              >
                {(f.opts ?? []).map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.l}
                  </option>
                ))}
              </select>
            ) : f.type === "textarea" ? (
              <textarea
                rows={3}
                lang={lang}
                spellCheck
                value={f.val}
                onChange={f.on}
                aria-invalid={f.err}
                placeholder={f.placeholder}
                style={{
                  ...FORM.input,
                  height: "auto",
                  padding: "8px 10px",
                  resize: "vertical",
                  fontFamily: "inherit",
                  borderColor: f.bd,
                }}
              />
            ) : (
              <input
                type={f.type}
                value={f.val}
                onChange={f.on}
                aria-invalid={f.err}
                placeholder={f.placeholder}
                dir={f.ltr ? "ltr" : undefined}
                lang={f.ltr ? undefined : "ar"}
                spellCheck={f.type === "text" && !f.ltr}
                style={{
                  ...FORM.input,
                  height: 40,
                  borderColor: f.bd,
                  textAlign: f.ltr ? "left" : undefined,
                }}
              />
            )}
          </label>
          {f.hint ? <span style={FORM.hint}>{f.hint}</span> : null}
        </div>
      ))}
    </div>
  );
}
