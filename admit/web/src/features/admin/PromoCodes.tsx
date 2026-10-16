import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/api";
import type { PromoCode, PromoInput } from "@/api/types";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { SelectField, TextField } from "@/components/Field";
import { Notice } from "@/components/Notice";
import { useToast } from "@/components/Toast";
import { fromInputValue, toInputValue } from "@/lib/datetime";
import { errorText } from "@/lib/errors";
import { money } from "@/lib/format";
import { GLYPH } from "@/lib/status";
import { ApiError } from "@/services/http";

const blank = {
  code: "",
  kind: "percent" as "percent" | "fixed",
  value: "",
  maxUses: "",
  validFrom: "",
  validUntil: "",
};

const offText = (p: Pick<PromoCode, "kind" | "value">, currency: string) =>
  p.kind === "percent" ? `${p.value}% off` : `${money(p.value, currency)} off`;

const windowText = (p: PromoCode) => {
  const f = (iso: string) => toInputValue(iso).replace("T", " ");
  if (p.validFrom && p.validUntil) return `${f(p.validFrom)} to ${f(p.validUntil)}`;
  if (p.validFrom) return `from ${f(p.validFrom)}`;
  if (p.validUntil) return `until ${f(p.validUntil)}`;
  return "any time";
};

/** Discount codes for one event: create, switch on/off, delete. Guests apply a code on the checkout page. */
export function PromoCodes({
  eventId,
  currency,
  locked,
}: {
  eventId: string;
  currency: string;
  locked: boolean;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["admin", "promos", eventId],
    queryFn: () => adminApi.events.promos(eventId),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "promos", eventId] });

  const fail = (err: unknown) => {
    if (err instanceof ApiError && err.fields.length) {
      setErrors(Object.fromEntries(err.fields.map((x) => [x.path, x.message])));
      setMessage(null);
    } else setMessage(errorText(err));
  };

  const create = useMutation({
    mutationFn: () => {
      const num = Number(f.value);
      const body: PromoInput = {
        code: f.code,
        kind: f.kind,
        value: f.kind === "fixed" ? Math.round(num * 100) : Math.round(num),
        maxUses: f.maxUses.trim() ? Math.round(Number(f.maxUses)) : null,
        validFrom: f.validFrom ? fromInputValue(f.validFrom) : null,
        validUntil: f.validUntil ? fromInputValue(f.validUntil) : null,
        enabled: true,
      };
      setErrors({});
      setMessage(null);
      return adminApi.events.createPromo(eventId, body);
    },
    onSuccess: async (p) => {
      setF(blank);
      await refresh();
      toast.show(`Code ${p.code} created`);
    },
    onError: fail,
  });
  const toggle = useMutation({
    mutationFn: (p: PromoCode) => adminApi.events.updatePromo(p.id, { enabled: !p.enabled }),
    onSuccess: refresh,
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: (id: string) => adminApi.events.removePromo(id),
    onSuccess: async () => {
      setConfirmId(null);
      await refresh();
      toast.show("Code deleted");
    },
    onError: fail,
  });

  const valueOk = Number(f.value) > 0 && (f.kind === "fixed" || Number(f.value) <= 99);
  const canCreate = f.code.trim().length >= 3 && valueOk && !create.isPending;
  const set = (k: keyof typeof blank, v: string) => setF((p) => ({ ...p, [k]: v }));
  const items = list.data ?? [];

  return (
    <section
      id="promos"
      className="flex scroll-mt-40 flex-col gap-3.5 border border-rule bg-surface p-5"
    >
      <h2 className="m-0 text-[17px] font-semibold">Promo codes</h2>
      <p className="m-0 text-sm text-ink-2">
        Give a discount to guests who enter a code at checkout. The discount comes off the whole
        order. A booking that is rejected, expired or cancelled gives its use of the code back.
      </p>
      {message ? <Notice tone="bad">{message}</Notice> : null}

      {list.isError ? (
        <Notice tone="bad">{errorText(list.error)}</Notice>
      ) : items.length === 0 ? (
        <p className="m-0 text-sm text-muted">
          {list.isPending ? "Loading…" : "No promo codes yet."}
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {items.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-rule py-3"
            >
              <span className="min-w-[110px] font-mono text-sm font-semibold">{p.code}</span>
              <span className="text-sm">{offText(p, currency)}</span>
              <span className="text-xs text-muted">
                Used {p.usedCount}
                {p.maxUses !== null ? ` of ${p.maxUses}` : ""} · {windowText(p)}
              </span>
              <span className="ml-auto flex items-center gap-2">
                <Badge
                  status={
                    p.enabled
                      ? { tone: "ok", glyph: GLYPH.ok, label: "Active" }
                      : { tone: "off", glyph: GLYPH.off, label: "Off" }
                  }
                />
                {!locked ? (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={toggle.isPending && toggle.variables?.id === p.id}
                      onClick={() => toggle.mutate(p)}
                    >
                      {p.enabled ? "Turn off" : "Turn on"}
                    </Button>
                    {confirmId === p.id ? (
                      <Button
                        variant="danger"
                        size="sm"
                        loading={remove.isPending}
                        onClick={() => remove.mutate(p.id)}
                      >
                        Delete for good?
                      </Button>
                    ) : (
                      <Button variant="secondary" size="sm" onClick={() => setConfirmId(p.id)}>
                        Delete
                      </Button>
                    )}
                  </>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!locked ? (
        <div className="flex flex-col gap-3 border-t border-rule pt-4">
          <span className="label text-ink-2">New code</span>
          <div className="grid gap-3 sm:grid-cols-3">
            <TextField
              label="Code"
              mono
              value={f.code}
              onChange={(e) => set("code", e.target.value.toUpperCase())}
              placeholder="EARLYBIRD"
              error={errors.code}
              autoComplete="off"
            />
            <SelectField label="Type" value={f.kind} onChange={(e) => set("kind", e.target.value)}>
              <option value="percent">Percentage off</option>
              <option value="fixed">Fixed amount off</option>
            </SelectField>
            <TextField
              label={f.kind === "percent" ? "Percent (1-99)" : `Amount (${currency})`}
              type="number"
              min={1}
              value={f.value}
              onChange={(e) => set("value", e.target.value)}
              error={errors.value}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <TextField
              label="Max uses"
              type="number"
              min={1}
              value={f.maxUses}
              onChange={(e) => set("maxUses", e.target.value)}
              placeholder="Unlimited"
              error={errors.maxUses}
            />
            <TextField
              label="Valid from"
              type="datetime-local"
              value={f.validFrom}
              onChange={(e) => set("validFrom", e.target.value)}
              hint="Optional"
              error={errors.validFrom}
            />
            <TextField
              label="Valid until"
              type="datetime-local"
              value={f.validUntil}
              onChange={(e) => set("validUntil", e.target.value)}
              hint="Optional"
              error={errors.validUntil}
            />
          </div>
          <div>
            <Button
              variant="secondary"
              size="md"
              loading={create.isPending}
              disabled={!canCreate}
              onClick={() => create.mutate()}
            >
              Create code
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
