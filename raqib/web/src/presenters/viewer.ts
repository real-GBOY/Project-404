import type { EvidenceItem } from "@/api/types";
import type { Ctx } from "./context";

/** Open the protected viewer for a stored evidence file. Bytes are only fetched through the authorized endpoint. */
export function openEvidence(c: Ctx, e: Pick<EvidenceItem, "id" | "name" | "kind" | "mime" | "sizeBytes" | "at" | "by">, supports: string): void {
  c.set({
    viewer: { id: e.id, name: e.name, kind: e.kind, mime: e.mime, sizeBytes: e.sizeBytes, at: e.at, by: e.by, link: supports },
    viewerUrl: null,
    viewerReq: e.kind !== "video",
    viewerErr: false,
  });
}

const mb = (n: number) => (n / 1_048_576).toFixed(1);

/** View-model of the evidence viewer (design: vm.vw). `null` when nothing is open. */
export function viewerVM(c: Ctx, onDownload: (id: string, name: string) => void) {
  const { i, ui, set, me } = c;
  const v = ui.viewer;
  if (!v) return null;
  const close = () => set({ viewer: null, viewerUrl: null, viewerReq: false, viewerErr: false });
  const loading = ui.viewerReq && !ui.viewerUrl && !ui.viewerErr;
  return {
    name: v.name,
    kind: i.S(v.kind === "video" ? "evVideo" : v.kind === "doc" ? "evDoc" : "evPhoto"),
    close,
    isVideo: v.kind === "video",
    isDoc: v.kind === "doc",
    isPhotoNoUrl: v.kind === "photo" && !ui.viewerUrl,
    bgImg: v.kind === "photo" && ui.viewerUrl ? `url("${ui.viewerUrl}")` : "none",
    videoUrl: v.kind === "video" ? ui.viewerUrl : null,
    linked: !!ui.viewerUrl && v.kind === "video",
    linkTxt: i.S("vw_loaded"),
    protectedTxt: ui.viewerErr ? i.S("vw_failed") : loading ? i.S("vw_loading") : i.S("vw_protectedNote"),
    reqLink: () => set({ viewerReq: true, viewerErr: false }),
    meta: [
      { k: i.S("vw_type"), v: v.mime },
      { k: i.S("vw_size"), v: `${mb(v.sizeBytes)} MB` },
      { k: i.S("vw_at"), v: i.fd(v.at, "dt") },
      ...(v.by ? [{ k: i.S("vw_by"), v: v.by }] : []),
      { k: i.S("vw_for"), v: v.link },
    ],
    canDownload: ["inspections", "reports"].some((m) => me.permissions[m as "inspections" | "reports"].includes("D")),
    download: () => onDownload(v.id, v.name),
  };
}
