import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useUrlParams } from "@/hooks/use-url-params";
import { formatDate, formatMoney } from "@/lib/format";
import { SUPPORTED_LOCALES } from "@/lib/i18n";
import { useToast } from "@/components/ui/toast-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormField } from "@/components/forms/form-field";
import { QueryBoundary } from "@/components/feedback/query-boundary";
import { RowsSkeleton, Skeleton } from "@/components/feedback/skeleton";
import * as api from "../api/settings.api";
import { settingsKeys } from "../api/settings.api";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="flex flex-col gap-4">
    <h2 className="text-[15px] font-bold tracking-tight text-foreground">{title}</h2>
    {children}
  </section>
);

function useSettings() {
  return useQuery({ queryKey: settingsKeys.firm, queryFn: ({ signal }) => api.getSettings(signal) });
}
function useSettingsMutation() {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation("settings");
  return useMutation({
    mutationFn: api.patchSettings,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.firm });
      toast.success({ title: t("toasts.saved") });
    },
    onError: () => toast.error({ title: t("toasts.failed") }),
  });
}

export function FirmProfileSection() {
  const { t } = useTranslation("settings");
  const { can } = usePermissions();
  const query = useSettings();
  const save = useSettingsMutation();
  const [form, setForm] = useState({ firmName: "", registrationNumber: "", address: "" });
  const editable = can("update:lawfirm_setting");

  useEffect(() => {
    if (query.data)
      setForm({
        firmName: query.data.firmName,
        registrationNumber: query.data.registrationNumber,
        address: query.data.address,
      });
  }, [query.data]);

  return (
    <Section title={t("sections.firm")}>
      <QueryBoundary query={query} loading={<Skeleton className="h-48" />}>
        {() => (
          <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4">
            <FormField label={t("firm.name")}>
              <Input
                value={form.firmName}
                disabled={!editable}
                onChange={(e) => setForm({ ...form, firmName: e.target.value })}
              />
            </FormField>
            <FormField label={t("firm.registration")}>
              <Input
                value={form.registrationNumber}
                disabled={!editable}
                onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
              />
            </FormField>
            <FormField label={t("firm.address")}>
              <Input
                value={form.address}
                disabled={!editable}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </FormField>
            {editable && (
              <div className="flex justify-end">
                <Button loading={save.isPending} onClick={() => save.mutate(form)}>
                  {t("common:actions.save_changes")}
                </Button>
              </div>
            )}
          </div>
        )}
      </QueryBoundary>
    </Section>
  );
}

function ChipList({
  items,
  onChange,
  editable,
  placeholder,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  editable: boolean;
  placeholder: string;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className="inline-flex items-center gap-1 rounded-pill bg-surface-subtle px-2 py-1 text-[11.5px]">
          {item}
          {editable && (
            <button type="button" onClick={() => onChange(items.filter((x) => x !== item))} aria-label="Remove">
              <Icon name="close" size={12} className="text-muted hover:text-danger" />
            </button>
          )}
        </span>
      ))}
      {editable && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim() && !items.includes(value.trim())) onChange([...items, value.trim()]);
            setValue("");
          }}
        >
          <Input
            className="h-7 w-40"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
          />
        </form>
      )}
    </div>
  );
}

export function PracticeSection() {
  const { t } = useTranslation("settings");
  const { can } = usePermissions();
  const query = useSettings();
  const save = useSettingsMutation();
  const editable = can("update:lawfirm_setting");

  return (
    <Section title={t("sections.practice")}>
      <QueryBoundary query={query} loading={<Skeleton className="h-40" />}>
        {(s) => (
          <div className="flex flex-col gap-5 rounded-card border border-border bg-surface p-4">
            <div>
              <div className="mb-2 text-[12px] font-bold text-foreground-body">{t("practice.matter_types")}</div>
              <ChipList
                items={s.matterTypes}
                editable={editable}
                placeholder={t("practice.add_type")}
                onChange={(matterTypes) => save.mutate({ matterTypes })}
              />
            </div>
            <div>
              <div className="mb-2 text-[12px] font-bold text-foreground-body">{t("practice.courts")}</div>
              <ChipList
                items={s.courts}
                editable={editable}
                placeholder={t("practice.add_court")}
                onChange={(courts) => save.mutate({ courts })}
              />
            </div>
          </div>
        )}
      </QueryBoundary>
    </Section>
  );
}

export function BillingSection() {
  const { t } = useTranslation("settings");
  const query = useSettings();

  return (
    <Section title={t("sections.billing")}>
      <QueryBoundary query={query} loading={<Skeleton className="h-48" />}>
        {(s) => (
          <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-muted">{t("billing.vat_rate")}</span>
              <span className="font-bold tabular-nums text-foreground">{Math.round(s.vatRate * 100)}%</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-muted">{t("billing.default_currency")}</span>
              <span className="font-bold text-foreground">{s.defaultCurrency}</span>
            </div>
            <div>
              <div className="mb-2 text-[12px] font-bold text-foreground-body">{t("billing.standard_rates")}</div>
              <div className="divide-y divide-divider rounded-md border border-border">
                {s.standardRates.map((r) => (
                  <div key={r.role} className="flex items-center justify-between px-3 py-2 text-[12.5px]">
                    <span className="text-foreground-body">{r.role}</span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {formatMoney({ currency: r.currency, amount: String(r.hourlyRate) })} / {t("billing.hour")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </QueryBoundary>
    </Section>
  );
}

export function AssistantSection() {
  const { t } = useTranslation("settings");
  const { can } = usePermissions();
  const query = useSettings();
  const save = useSettingsMutation();

  return (
    <Section title={t("sections.assistant")}>
      <QueryBoundary query={query} loading={<Skeleton className="h-24" />}>
        {(s) => (
          <div className="flex items-center justify-between rounded-card border border-border bg-surface p-4">
            <div>
              <div className="text-[13px] font-semibold text-foreground">{t("assistant.enable")}</div>
              <p className="text-[12px] text-muted">{t("assistant.note")}</p>
            </div>
            <Switch
              checked={s.aiAssistantEnabled}
              disabled={!can("update:lawfirm_setting")}
              onCheckedChange={(v) => save.mutate({ aiAssistantEnabled: v })}
              aria-label={t("assistant.enable")}
            />
          </div>
        )}
      </QueryBoundary>
    </Section>
  );
}

export function UsersRolesSection() {
  const { t } = useTranslation("settings");
  const { can } = usePermissions();
  const qc = useQueryClient();
  const toast = useToast();
  const members = useQuery({ queryKey: settingsKeys.members, queryFn: ({ signal }) => api.getMembers(signal) });
  const roles = useQuery({ queryKey: settingsKeys.roles, queryFn: ({ signal }) => api.getRoles(signal) });
  const assign = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => api.assignRole(userId, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.members });
      toast.success({ title: t("toasts.role_changed") });
    },
  });
  const editable = can("assign:role");

  return (
    <Section title={t("sections.users")}>
      <QueryBoundary query={roles} loading={<Skeleton className="h-24" />}>
        {(r) => (
          <div className="flex flex-wrap gap-2">
            {r.items.map((role) => (
              <div key={role.key} className="rounded-md border border-border bg-surface px-3 py-2 text-[12px]">
                <div className="font-semibold text-foreground">{role.name}</div>
                <div className="text-muted">{t("users.permissions", { count: role.permissions })}</div>
              </div>
            ))}
          </div>
        )}
      </QueryBoundary>

      <QueryBoundary query={members} loading={<RowsSkeleton rows={5} />}>
        {(m) => (
          <div className="divide-y divide-divider rounded-card border border-border bg-surface">
            {m.items.map((member) => (
              <div key={member.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-[12.5px] font-semibold text-foreground">{member.name}</div>
                  <div className="text-[11.5px] text-muted">{member.email}</div>
                </div>
                {editable ? (
                  <Select
                    value={member.role}
                    onValueChange={(role) => assign.mutate({ userId: member.id, role })}
                  >
                    <SelectTrigger aria-label={t("users.role")} className="h-8 w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(roles.data?.items ?? []).map((role) => (
                        <SelectItem key={role.key} value={role.key}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge tone="neutral" size="sm">
                    {member.role}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </QueryBoundary>
    </Section>
  );
}

export function AuditSection() {
  const { t } = useTranslation("settings");
  const params = useUrlParams<"q">({});
  const q = params.get("q") ?? "";
  const query = useQuery({
    queryKey: settingsKeys.audit(q),
    queryFn: ({ signal }) => api.getAuditLogs(q, signal),
  });

  return (
    <Section title={t("sections.audit")}>
      <SearchInput
        className="max-w-xs"
        value={q}
        onChange={(e) => params.set({ q: e.target.value })}
        onClear={() => params.set({ q: undefined })}
        placeholder={t("audit.search")}
      />
      <QueryBoundary query={query} loading={<RowsSkeleton rows={8} />}>
        {(data) => (
          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border text-[11px] font-semibold text-muted">
                  <th className="px-3 py-2 text-start">{t("audit.when")}</th>
                  <th className="px-3 py-2 text-start">{t("audit.actor")}</th>
                  <th className="px-3 py-2 text-start">{t("audit.action")}</th>
                  <th className="px-3 py-2 text-start">{t("audit.ip")}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((a) => (
                  <tr key={a.id} className="border-b border-divider last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 text-muted">{formatDate(a.at, { dateStyle: "medium", timeStyle: "short" })}</td>
                    <td className="px-3 py-2 text-foreground-body">{a.actor}</td>
                    <td className="px-3 py-2">
                      <span className="font-medium text-foreground">{a.action}</span>{" "}
                      <span className="text-subtle">{a.resource}</span>
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted">{a.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryBoundary>
    </Section>
  );
}

export function LocaleSection() {
  const { t, i18n } = useTranslation("settings");
  const current = i18n.language.startsWith("ar") ? "ar" : "en";
  return (
    <Section title={t("sections.locale")}>
      <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
        <p className="text-[12.5px] text-muted">{t("locale.note")}</p>
        <SegmentedControl
          aria-label={t("sections.locale")}
          value={current}
          onValueChange={(v) => void i18n.changeLanguage(v)}
          options={SUPPORTED_LOCALES.map((l) => ({ value: l, label: l === "ar" ? "العربية" : "English" }))}
        />
        <div className="text-[12px] text-muted">
          {t("locale.region")}: <span className="font-semibold text-foreground-body">Egypt · Africa/Cairo</span>
        </div>
      </div>
    </Section>
  );
}
