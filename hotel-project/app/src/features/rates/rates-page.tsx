import { useState, type FormEvent } from "react";
import {
  useArchiveRate,
  useCreateDiscount,
  useCreateRule,
  useRates,
  type RateRule,
} from "@/api/pricing";
import { useRoomTypes } from "@/api/rooms";
import { useAuth } from "@/features/auth/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { FormError, InputField, SelectField } from "@/components/ui/fields";
import { PageHeader } from "@/components/ui/page-header";
import { ToneBadge } from "@/components/ui/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import { formatEgp, formatIsoDate } from "@/lib/format";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Rates & discounts (not in the design; composed from its cards and badges). Each night of a stay
 * is priced by the highest-priority rule that applies; the server applies this on every quote.
 */
export function RatesPage() {
  const auth = useAuth();
  const rates = useRates();
  const types = useRoomTypes();
  const archive = useArchiveRate();
  const toast = useToast();
  const [dialog, setDialog] = useState<"rule" | "discount" | null>(null);
  const canManage = auth.can("manage:rate");
  const typeName = (id: string | null) =>
    id ? (types.data?.find((t) => t.id === id)?.name ?? "One room type") : "All room types";

  async function retire(kind: "rule" | "discount", id: string, label: string) {
    try {
      await archive.mutateAsync({ kind, id });
      toast(`${label} retired`);
    } catch {
      toast(`Couldn't retire ${label}`);
    }
  }

  return (
    <>
      <PageHeader
        title="Rates & Discounts"
        subtitle="Each night uses the base rate unless a rule applies — the highest priority wins."
        actions={
          canManage ? (
            <>
              <Button variant="secondary" onClick={() => setDialog("discount")}>
                + Discount code
              </Button>
              <Button onClick={() => setDialog("rule")}>+ Rate rule</Button>
            </>
          ) : null
        }
      />
      {rates.isLoading ? (
        <LoadingState />
      ) : rates.error ? (
        <ErrorState error={rates.error} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Card>
            <CardTitle>Rate rules</CardTitle>
            {rates.data!.rules.length === 0 ? (
              <EmptyState title="Every night is priced at the room type's base rate." />
            ) : (
              <ul className="m-0 list-none p-0">
                {rates.data!.rules.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-start justify-between gap-3 border-b border-divider py-3 last:border-b-0"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-small font-bold">
                        {r.name}
                        <ToneBadge
                          tone={
                            r.kind === "promotion"
                              ? "success"
                              : r.kind === "weekend"
                                ? "info"
                                : "warning"
                          }
                        >
                          {r.kind[0]!.toUpperCase() + r.kind.slice(1)}
                        </ToneBadge>
                      </div>
                      <div className="mt-1 text-label text-muted">
                        {describeRule(r, typeName(r.roomTypeId))}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-small font-extrabold">
                        {r.adjustmentType === "fixed_rate"
                          ? formatEgp(r.adjustmentValue)
                          : `${r.adjustmentValue > 0 ? "+" : ""}${r.adjustmentValue}%`}
                      </span>
                      {canManage ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => void retire("rule", r.id, r.name)}
                        >
                          Retire
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="self-start">
            <CardTitle>Discount codes</CardTitle>
            {rates.data!.discounts.length === 0 ? (
              <EmptyState title="No discount codes." />
            ) : (
              <ul className="m-0 list-none p-0">
                {rates.data!.discounts.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-3 border-b border-divider py-3 last:border-b-0"
                  >
                    <div>
                      <div className="font-mono text-small font-bold">{d.code}</div>
                      <div className="text-label text-muted">{d.description ?? "—"}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-small font-extrabold">−{d.percentOff}%</span>
                      {canManage ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => void retire("discount", d.id, d.code)}
                        >
                          Retire
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
      {dialog === "rule" ? <RuleDialog onClose={() => setDialog(null)} /> : null}
      {dialog === "discount" ? <DiscountDialog onClose={() => setDialog(null)} /> : null}
    </>
  );
}

function describeRule(r: RateRule, typeName: string): string {
  const parts = [typeName];
  if (r.startDate || r.endDate) {
    parts.push(
      `${r.startDate ? formatIsoDate(r.startDate, true) : "…"} – ${r.endDate ? formatIsoDate(r.endDate, true) : "…"}`,
    );
  }
  if (r.daysOfWeek) parts.push(`${r.daysOfWeek.map((d) => WEEKDAYS[d]).join(" & ")} nights`);
  if (r.minNights) parts.push(`min ${r.minNights} nights`);
  parts.push(`priority ${r.priority}`);
  return parts.join(" · ");
}

function RuleDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateRule();
  const types = useRoomTypes();
  const toast = useToast();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<RateRule["kind"]>("seasonal");
  const [roomTypeId, setRoomTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [days, setDays] = useState<number[]>([]);
  const [adjustmentType, setAdjustmentType] = useState<RateRule["adjustmentType"]>("percent");
  const [value, setValue] = useState("");
  const [minNights, setMinNights] = useState("");
  const [priority, setPriority] = useState("1");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await create.mutateAsync({
        name: name.trim(),
        kind,
        roomTypeId: roomTypeId || null,
        startDate: startDate || null,
        endDate: endDate || null,
        daysOfWeek: days.length ? days : null,
        adjustmentType,
        adjustmentValue: Number(value),
        minNights: minNights ? Number(minNights) : null,
        priority: Number(priority),
      });
      toast(`${name.trim()} added`);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Dialog
      open
      title="New rate rule"
      onClose={onClose}
      width={560}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" type="submit" form="rule-form" disabled={create.isPending}>
            Save rule
          </Button>
        </>
      }
    >
      <form id="rule-form" onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-[1fr_150px] gap-4">
          <InputField
            label="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <SelectField
            label="Kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as RateRule["kind"])}
          >
            <option value="seasonal">Seasonal</option>
            <option value="weekend">Weekend</option>
            <option value="promotion">Promotion</option>
          </SelectField>
        </div>
        <SelectField
          label="Applies to"
          value={roomTypeId}
          onChange={(e) => setRoomTypeId(e.target.value)}
        >
          <option value="">All room types</option>
          {(types.data ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </SelectField>
        <div className="grid grid-cols-2 gap-4">
          <InputField
            label="From (optional)"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <InputField
            label="Until (optional)"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-1.5 text-label font-semibold text-muted">
            Nights (none = every night)
          </legend>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d, i) => (
              <label key={d} className="flex cursor-pointer items-center gap-1.5 text-small">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={days.includes(i)}
                  onChange={(e) =>
                    setDays((prev) =>
                      e.target.checked ? [...prev, i].sort() : prev.filter((x) => x !== i),
                    )
                  }
                />
                {d}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SelectField
            label="Adjustment"
            value={adjustmentType}
            onChange={(e) => setAdjustmentType(e.target.value as RateRule["adjustmentType"])}
          >
            <option value="percent">± Percent</option>
            <option value="fixed_rate">Fixed rate (EGP)</option>
          </SelectField>
          <InputField
            label="Value"
            type="number"
            step="0.01"
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <InputField
            label="Min nights"
            type="number"
            min={1}
            max={30}
            value={minNights}
            onChange={(e) => setMinNights(e.target.value)}
          />
          <InputField
            label="Priority"
            type="number"
            min={0}
            max={100}
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          />
        </div>
        <FormError message={error} />
      </form>
    </Dialog>
  );
}

function DiscountDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateDiscount();
  const toast = useToast();
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [percentOff, setPercentOff] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await create.mutateAsync({
        code: code.trim().toUpperCase(),
        description: description.trim() || null,
        percentOff: Number(percentOff),
        validFrom: validFrom || null,
        validTo: validTo || null,
      });
      toast(`${code.trim().toUpperCase()} added`);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Dialog
      open
      title="New discount code"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" type="submit" form="discount-form" disabled={create.isPending}>
            Save code
          </Button>
        </>
      }
    >
      <form id="discount-form" onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-[1fr_120px] gap-4">
          <InputField
            label="Code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            hint="e.g. NILE10"
          />
          <InputField
            label="% off"
            type="number"
            min={1}
            max={100}
            required
            value={percentOff}
            onChange={(e) => setPercentOff(e.target.value)}
          />
        </div>
        <InputField
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-4">
          <InputField
            label="Valid from (arrival)"
            type="date"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
          />
          <InputField
            label="Valid until (arrival)"
            type="date"
            value={validTo}
            onChange={(e) => setValidTo(e.target.value)}
          />
        </div>
        <FormError message={error} />
      </form>
    </Dialog>
  );
}
