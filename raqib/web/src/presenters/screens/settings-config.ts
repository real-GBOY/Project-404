import type { RoleKey } from "@/api/types";
import { getUi } from "@/state/ui-store";
import type { Ctx } from "../context";
import { ROLE_LABEL } from "./users";
import { C } from "@/styles/colors";

type Draft = Record<string, Record<string, unknown>>;

/**
 * The settings fields that are not one scalar in the draft: shifts, escalation levels, and the deduction rules (which are
 * read from, and published to, their own endpoint rather than the settings draft).
 */
export function configFields(c: Ctx, cur: Draft, saved: Draft | undefined, ro: boolean) {
  const { i, data, set } = c;
  // ── fields that are not one scalar in the draft: shifts, escalation levels, the deduction rules ──
  const mutate = (fn: (d: Draft) => void) => {
    const base = JSON.parse(JSON.stringify(getUi().setd ?? saved)) as Draft;
    fn(base);
    set({ setd: base });
  };
  const flags = {
    isText: false,
    isNum: false,
    isTog: false,
    isSel: false,
    isInfo: false,
    isPair: false,
    isChips: false,
    isBtn: false,
    hasHelp: false,
    help: "",
    ro,
  };
  const textF = (label: string, val: string, write: (v: string) => void, ltr = false) => ({
    ...flags,
    isText: true,
    label,
    val,
    ltr,
    onText: (e: { target: { value: string } }) => write(e.target.value),
  });
  const numF = (label: string, val: number, write: (v: number) => void, unit?: string) => ({
    ...flags,
    isNum: true,
    label,
    val,
    unit,
    onText: (e: { target: { value: string } }) => write(Number(e.target.value)),
  });
  const togF = (label: string, on: boolean, write: (v: boolean) => void) => ({
    ...flags,
    isTog: true,
    label,
    on,
    tbg: on ? C.brand.primary : C.border.strong,
    tpos: on ? "flex-end" : "flex-start",
    toggle: () => !ro && write(!on),
  });
  const selF = (
    label: string,
    val: string,
    opts: Array<{ v: string; l: string }>,
    write: (v: string) => void,
  ) => ({
    ...flags,
    isSel: true,
    label,
    val,
    opts,
    onText: (e: { target: { value: string } }) => write(e.target.value),
  });
  const chipsF = (label: string, items: Array<{ l: string; on: boolean; toggle: () => void }>) => ({
    ...flags,
    isChips: true,
    label,
    chips: items.map((x) => ({
      l: x.l,
      bg: x.on ? C.text.ink : C.surface.white,
      fg: x.on ? C.surface.white : C.text.body,
      toggle: () => !ro && x.toggle(),
    })),
  });
  const btnF = (label: string, btnLabel: string, onClick: () => void, disabled = false) => ({
    ...flags,
    isBtn: true,
    label,
    btnLabel,
    onClick,
    btnDisabled: disabled,
  });
  const toggleIn = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : list.concat([v]);

  type Shift = { key: string; nameAr: string; nameEn: string; start: string; end: string };
  type Level = { days: number; roles: string[] };
  const sch = (cur.schedule ?? {}) as unknown as {
    shifts?: Shift[];
    minRestHours?: number;
    maxConsecutiveDays?: number;
  };
  const esc = (cur.escalation ?? {}) as unknown as {
    enabled?: boolean;
    countFrom?: string;
    weekend?: number[];
    levels?: Level[];
    highSeverity?: { immediate?: boolean; roles?: string[] };
  };
  const shifts = sch.shifts ?? [];
  const levels = esc.levels ?? [];
  const ESC_ROLES = ["responsible", "qm", "qe", "pm", "ins", "gs", "gm", "adm"];
  const roleLabel = (r: string) =>
    r === "responsible" ? i.S("sf_role_responsible") : i.L(ROLE_LABEL[r as RoleKey]);
  const roleChips = (list: string[], write: (next: string[]) => void) =>
    ESC_ROLES.map((r) => ({
      l: roleLabel(r),
      on: list.includes(r),
      toggle: () => write(toggleIn(list, r)),
    }));
  const shiftSet = (idx: number, patch: Partial<Shift>) =>
    mutate((d) => {
      const arr = (d.schedule as unknown as { shifts: Shift[] }).shifts;
      arr[idx] = { ...arr[idx]!, ...patch };
    });
  const levelSet = (idx: number, patch: Partial<Level>) =>
    mutate((d) => {
      const arr = (d.escalation as unknown as { levels: Level[] }).levels;
      arr[idx] = { ...arr[idx]!, ...patch };
    });

  const scheduleFields = [
    ...shifts.flatMap((s, idx) => [
      textF(`${idx + 1}. ${i.S("sf_sch_nameAr")} · ${s.key}`, s.nameAr, (v) =>
        shiftSet(idx, { nameAr: v }),
      ),
      textF(
        `${idx + 1}. ${i.S("sf_sch_nameEn")} · ${s.key}`,
        s.nameEn,
        (v) => shiftSet(idx, { nameEn: v }),
        true,
      ),
      textF(
        `${idx + 1}. ${i.S("sf_sch_start")}`,
        s.start,
        (v) => shiftSet(idx, { start: v }),
        true,
      ),
      textF(`${idx + 1}. ${i.S("sf_sch_end")}`, s.end, (v) => shiftSet(idx, { end: v }), true),
    ]),
    btnF(i.S("sf_sch_add"), i.S("sf_sch_addBtn"), () =>
      mutate((d) => {
        const arr = (d.schedule as unknown as { shifts: Shift[] }).shifts;
        let n = arr.length + 1;
        while (arr.some((x) => x.key === `shift_${n}`)) n++;
        arr.push({
          key: `shift_${n}`,
          nameAr: i.S("sh_shiftN", { n }, "ar"),
          nameEn: i.S("sh_shiftN", { n }, "en"),
          start: "",
          end: "",
        });
      }),
    ),
    btnF(
      i.S("sf_sch_remove"),
      i.S("sf_sch_removeBtn"),
      () => mutate((d) => (d.schedule as unknown as { shifts: Shift[] }).shifts.pop()),
      shifts.length <= 1,
    ),
    numF(
      i.S("sf_sch_rest"),
      sch.minRestHours ?? 0,
      (v) => mutate((d) => ((d.schedule as Record<string, unknown>).minRestHours = v)),
      `${i.S("u_hours")} · ${i.S("sf_sch_off")}`,
    ),
    numF(
      i.S("sf_sch_consec"),
      sch.maxConsecutiveDays ?? 0,
      (v) => mutate((d) => ((d.schedule as Record<string, unknown>).maxConsecutiveDays = v)),
      `${i.S("u_days")} · ${i.S("sf_sch_off")}`,
    ),
  ];

  const escalationFields = [
    togF(i.S("sf_esc_enabled"), esc.enabled === true, (v) =>
      mutate((d) => ((d.escalation as Record<string, unknown>).enabled = v)),
    ),
    selF(
      i.S("sf_esc_countFrom"),
      esc.countFrom ?? "assigned",
      [
        { v: "assigned", l: i.S("esc_fromAssigned") },
        { v: "due", l: i.S("esc_fromDue") },
      ],
      (v) => mutate((d) => ((d.escalation as Record<string, unknown>).countFrom = v)),
    ),
    chipsF(
      i.S("sf_esc_weekend"),
      [0, 1, 2, 3, 4, 5, 6].map((n) => ({
        l: i.S(`wk_${n}`),
        on: (esc.weekend ?? []).includes(n),
        toggle: () =>
          mutate((d) => {
            const w = (d.escalation as unknown as { weekend: number[] }).weekend;
            (d.escalation as unknown as { weekend: number[] }).weekend = w.includes(n)
              ? w.filter((x) => x !== n)
              : [...w, n].sort();
          }),
      })),
    ),
    ...levels.flatMap((lv, idx) => [
      numF(
        i.S("sf_esc_level", { n: idx + 1 }),
        lv.days,
        (v) => levelSet(idx, { days: v }),
        i.S("u_days"),
      ),
      chipsF(
        i.S("sf_esc_levelRoles", { n: idx + 1 }),
        roleChips(lv.roles, (next) => levelSet(idx, { roles: next })),
      ),
    ]),
    btnF(
      i.S("sf_esc_addLevel"),
      i.S("sf_sch_addBtn"),
      () =>
        mutate((d) => {
          const arr = (d.escalation as unknown as { levels: Level[] }).levels;
          arr.push({ days: (arr.at(-1)?.days ?? 0) + 3, roles: ["qm"] });
        }),
      levels.length >= 5,
    ),
    btnF(
      i.S("sf_esc_removeLevel"),
      i.S("sf_sch_removeBtn"),
      () => mutate((d) => (d.escalation as unknown as { levels: Level[] }).levels.pop()),
      levels.length <= 1,
    ),
    togF(i.S("sf_esc_high"), esc.highSeverity?.immediate === true, (v) =>
      mutate(
        (d) =>
          ((
            d.escalation as unknown as { highSeverity: Record<string, unknown> }
          ).highSeverity.immediate = v),
      ),
    ),
    chipsF(
      i.S("sf_esc_highRoles"),
      roleChips(esc.highSeverity?.roles ?? [], (next) =>
        mutate(
          (d) =>
            ((
              d.escalation as unknown as { highSeverity: Record<string, unknown> }
            ).highSeverity.roles = next),
        ),
      ),
    ),
  ];

  const sc = data.scoring;
  const gm = c.me.role === "gm";
  const sevOf = (k: string) => (sc?.current ? String(sc.current.bySeverity[k] ?? "—") : "—");
  const deductionFields = [
    {
      ...flags,
      isInfo: true,
      label: i.S("sf_ded_title"),
      val: sc?.current
        ? i.S("sf_ded_current", { v: sc.current.version, b: sc.current.base })
        : i.S("sf_ded_none"),
    },
    ...(sc?.current
      ? [
          { ...flags, isInfo: true, label: i.S("sf_ded_high"), val: sevOf("high") },
          { ...flags, isInfo: true, label: i.S("sf_ded_medium"), val: sevOf("medium") },
          { ...flags, isInfo: true, label: i.S("sf_ded_low"), val: sevOf("low") },
          ...Object.entries(sc.current.byItem).map(([k, v]) => ({
            ...flags,
            isInfo: true,
            label: `${i.S("sf_ded_items")} · ${k}`,
            val: String(v),
          })),
        ]
      : []),
    btnF(
      sc?.canPublish
        ? i.S("sf_ded_publish")
        : `${i.S("sf_ded_publish")} — ${i.S("sf_ded_notAdmin")}`,
      i.S("sf_ded_publishBtn"),
      () =>
        c.openModal("scoringRules", undefined, {
          sevHigh: String(sc?.current?.bySeverity.high ?? ""),
          sevMed: String(sc?.current?.bySeverity.medium ?? ""),
          sevLow: String(sc?.current?.bySeverity.low ?? ""),
          items: Object.entries(sc?.current?.byItem ?? {})
            .map(([k, v]) => `${k} = ${v}`)
            .join("\n"),
        }),
      !sc?.canPublish,
    ),
    ...(sc?.designees ?? []).map((d) => ({
      ...btnF(
        `${i.S("sf_ded_designees")} · ${i.L(d.name)}`,
        i.S("sf_ded_revokeBtn"),
        () => void c.actions.revokeScoring(d.userId),
        !gm,
      ),
    })),
    ...(gm
      ? [
          btnF(i.S("sf_ded_designate"), i.S("sf_ded_designateBtn"), () =>
            c.openModal("scoringDesignate"),
          ),
        ]
      : []),
  ];

  return { scheduleFields, escalationFields, deductionFields };
}
