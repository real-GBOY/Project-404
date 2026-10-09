import { badge, scoreColor } from "../common";
import type { Ctx } from "../context";
import { guardsList } from "./projects";
import { VST, startInspection, visitRow } from "./visits";
import { C } from "@/styles/colors";
export { overviewQuality } from "./overview-quality";

const first = (c: Ctx): string =>
  c.i.L(c.me.name).replace("م. ", "").replace("Eng. ", "").split(" ")[0] ?? "";
const heading = (c: Ctx) => ({
  greeting: c.i.S("greet", { n: first(c) }),
  todayLong: c.i.fd(c.me.today, "dy"),
});

/** Project manager overview (design: vmOvPm). */
export function overviewProjectManager(c: Ctx) {
  const { i, data } = c;
  const projects = data.projects ?? [];
  const nextVisit = (data.visits ?? [])
    .filter((v) => v.date >= c.me.today && ["scheduled", "assigned"].includes(v.status))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
  return {
    ...heading(c),
    pm: {
      attention: [
        {
          n: 0,
          label: i.S("pm_myCA"),
          sub: i.S("pm_myCA_sub"),
          color: C.status.info.fg,
          go: () => c.go("actions"),
        },
        {
          n: 0,
          label: i.S("att_caOver"),
          sub: i.S("pm_od_sub"),
          color: C.status.danger.fg,
          go: () => c.go("actions"),
        },
        {
          n: 0,
          label: i.S("att_repeat"),
          sub: i.S("att_repeat_sub"),
          color: C.status.warning.fg,
          go: () => c.go("observations"),
        },
        {
          n: 0,
          label: i.S("pm_obs"),
          sub: i.S("pm_obs_sub"),
          color: C.text.ink,
          go: () => c.go("observations"),
        },
      ],
      projects: projects.map((p) => ({
        name: i.L(p.name),
        code: p.code,
        city: i.L(p.city),
        scoreTxt: "—",
        scoreC: scoreColor(null),
        scoreW: "0%",
        sub: p.firstVisitDate
          ? i.S("pm_mobilizing", { d: i.fd(p.firstVisitDate, "d") })
          : i.S("pm_projSub", { o: 0, c: 0, d: 0 }),
        go: () => c.go("project", p.id),
      })),
      cas: [],
      hasCas: false,
      next: nextVisit
        ? i.S("pm_next", {
            r: nextVisit.ref,
            d: i.fd(nextVisit.date, "d"),
            t: i.ft(nextVisit.time),
            s: i.L(nextVisit.site.name),
          })
        : i.S("pm_noNext"),
    },
  };
}

/** Inspector overview (design: vmOvIns). The visits the backend returns are already only this inspector's. */
export function overviewInspector(c: Ctx) {
  const { i, data, me } = c;
  const mine = data.visits ?? [];
  const card = (v: (typeof mine)[number]) => ({
    ...visitRow(c, v),
    primaryLabel:
      v.status === "in_progress"
        ? i.S("continueInsp")
        : v.status === "returned"
          ? i.S("openToFix")
          : ["assigned", "scheduled", "overdue"].includes(v.status)
            ? i.S("startInsp")
            : i.S("view"),
    primary: () =>
      ["assigned", "scheduled", "overdue", "in_progress", "returned"].includes(v.status)
        ? startInspection(c, v)
        : c.go("visit", v.id),
    progress: "",
    hasProgress: false,
  });
  const today = mine
    .filter((v) => v.date === me.today && v.storedStatus !== "cancelled")
    .sort((a, b) => a.time.localeCompare(b.time))
    .map(card);
  const up = mine
    .filter((v) => v.date > me.today && ["assigned", "scheduled"].includes(v.storedStatus))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(card);
  void VST;
  return {
    ins: {
      today,
      hasToday: !!today.length,
      noToday: !today.length,
      ret: [],
      hasRet: false,
      up,
      hasUp: !!up.length,
      rec: [],
      hasRec: false,
    },
    todayLong: i.fd(me.today, "dy"),
    insHead: today.length ? i.S("insHead", { n: today.length }) : i.S("insHeadNone"),
  };
}

/** Guards supervisor overview: the guard table plus their training queue (design: vmGuards). */
export function overviewGuardsSupervisor(c: Ctx) {
  return { ...guardsList(c), ...heading(c) };
}

/** Security guard home (design: vmOvGuard). */
export function overviewGuard(c: Ctx) {
  const { i } = c;
  const preset = () => () => c.go("confidential");
  return {
    greeting: i.S("greet", { n: first(c) }),
    gu: {
      sub: i.S("guardSub", { e: c.me.employeeNo ?? "", p: "" }).replace(/ · $/, ""),
      actions: [
        { label: i.S("ck_confidential"), sub: i.S("ck_confidential_sub"), go: preset() },
        { label: i.S("ck_complaint"), sub: i.S("ck_complaint_sub"), go: preset() },
        { label: i.S("ck_survey"), sub: i.S("ck_survey_sub"), go: () => c.go("surveys") },
      ],
      responses: [],
      hasResp: false,
      mine: [],
    },
  };
}

export { badge };
