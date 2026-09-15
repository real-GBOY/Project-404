import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/client";
import { useToast } from "@/lib/toast/toast-provider";

export interface QuickCreateField {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "select" | "textarea" | "email";
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}

export interface QuickCreateConfig {
  title: string;
  description?: string;
  submitLabel?: string;
  fields: QuickCreateField[];
  onSubmit: (values: Record<string, string>) => Promise<void>;
}

/**
 * One generic small-form modal used by every "primary action" button that
 * needs real input (New Lead, Reserve Unit, Record Payment, …) instead of
 * the plain yes/no `useConfirm()` dialog. Field lists are data — each
 * domain's `table-configs.ts` builds a `QuickCreateConfig` matching its
 * backend create schema's required fields.
 */
export function QuickCreateModal({
  open,
  onOpenChange,
  config,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: QuickCreateConfig | undefined;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (open && config) {
      const initial: Record<string, string> = {};
      for (const f of config.fields) initial[f.name] = f.defaultValue ?? "";
      setValues(initial);
      setError(null);
    }
  }, [open, config]);

  if (!config) return null;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await config!.onSubmit(values);
      onOpenChange(false);
      toast.push({ kind: "success", title: "Done", body: `${config!.title} saved.` });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = config.fields.every((f) => !f.required || (values[f.name] ?? "").trim().length > 0);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={config.title}
      description={config.description}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" loading={submitting} disabled={!canSubmit} onClick={handleSubmit}>
            {config.submitLabel ?? "Create"}
          </Button>
        </>
      }
    >
      <div className="mt-3 flex flex-col gap-2.5">
        {config.fields.map((f) => (
          <div key={f.name} className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted" htmlFor={`qc-${f.name}`}>
              {f.label}
            </label>
            {f.type === "select" ? (
              <select
                id={`qc-${f.name}`}
                required={f.required}
                value={values[f.name] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                className="h-8 w-full rounded-btn border border-border bg-surface px-2.5 text-[11.5px] text-foreground outline-none focus-visible:border-primary"
              >
                <option value="" disabled>
                  Select…
                </option>
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : f.type === "textarea" ? (
              <textarea
                id={`qc-${f.name}`}
                required={f.required}
                placeholder={f.placeholder}
                value={values[f.name] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                rows={3}
                className="w-full resize-none rounded-btn border border-border bg-surface px-2.5 py-2 text-[11.5px] text-foreground outline-none placeholder:text-placeholder focus-visible:border-primary"
              />
            ) : (
              <Input
                id={`qc-${f.name}`}
                type={f.type ?? "text"}
                required={f.required}
                placeholder={f.placeholder}
                value={values[f.name] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              />
            )}
          </div>
        ))}
        {error && (
          <div className="rounded-btn border border-danger-border bg-danger-surface px-2.5 py-2 text-[11px] text-danger">{error}</div>
        )}
      </div>
    </Modal>
  );
}
