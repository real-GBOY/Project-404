import type { Guard, ProjectStatus } from "@/api/types";
import type { ModalHandlers, ModalSubmit } from "./types";

const text = (v: unknown) => String(v ?? "").trim();
const pair = (f: ModalSubmit["f"], ar: string, en: string) => ({
  ar: text(f[ar]),
  en: text(f[en]),
});

/** The project fields as the backend takes them (the code is only sent on create). */
const projectBody = (f: ModalSubmit["f"]) => ({
  name: pair(f, "nameAr", "nameEn"),
  city: pair(f, "cityAr", "cityEn"),
  region: pair(f, "regionAr", "regionEn"),
  managerUserId: text(f.mgr) || null,
  status: (text(f.pstatus) || "mobilizing") as ProjectStatus,
  firstVisitDate: text(f.first) || null,
});

const guardBody = (f: ModalSubmit["f"]) => ({
  projectId: text(f.gproj),
  name: pair(f, "nameAr", "nameEn"),
  post: pair(f, "postAr", "postEn"),
  shift: (text(f.gshift) || "morning") as Guard["shift"],
  userId: text(f.gacct) || null,
});

/** Projects, sites and areas, and the guard roster. */
export const projectHandlers: ModalHandlers = {
  async projNew({ c, f }) {
    await c.actions.createProject({ code: text(f.code).toUpperCase(), ...projectBody(f) });
    c.toast(c.i.S("toastProjNew"));
  },
  async projEdit({ c, m, f }) {
    await c.actions.updateProject(String(m.id), projectBody(f));
    c.toast(c.i.S("toastProjEdit"));
  },
  async siteAdd({ c, m, f }) {
    await c.actions.addSite(String(m.id), pair(f, "nameAr", "nameEn"));
    c.toast(c.i.S("toastSiteAdd"));
  },
  async siteRename({ c, m, f }) {
    await c.actions.renameSite(String(m.id), pair(f, "nameAr", "nameEn"));
    c.toast(c.i.S("toastSiteEdit"));
  },
  async siteArchive({ c, m }) {
    await c.actions.archiveSite(String(m.id));
    c.toast(c.i.S("toastSiteOff"));
  },
  async areaAdd({ c, m, f }) {
    await c.actions.addArea(String(m.id), pair(f, "nameAr", "nameEn"));
    c.toast(c.i.S("toastAreaAdd"));
  },
  async areaArchive({ c, m }) {
    await c.actions.archiveArea(String(m.id));
    c.toast(c.i.S("toastAreaOff"));
  },
  async guardNew({ c, f }) {
    await c.actions.createGuard({
      ...guardBody(f),
      employeeNo: text(f.emp),
      nationalId: text(f.nid),
    });
    c.toast(c.i.S("toastGuardNew"));
  },
  async guardEdit({ c, m, f }) {
    const nid = text(f.nid);
    await c.actions.updateGuard(String(m.id), {
      ...guardBody(f),
      ...(nid ? { nationalId: nid } : {}),
    });
    c.toast(c.i.S("toastGuardEdit"));
  },
  async guardOff({ c, m }) {
    await c.actions.setGuardStatus(String(m.id), "inactive");
    c.toast(c.i.S("toastGuardOff"));
  },
  async guardOn({ c, m }) {
    await c.actions.setGuardStatus(String(m.id), "active");
    c.toast(c.i.S("toastGuardOn"));
  },
};
