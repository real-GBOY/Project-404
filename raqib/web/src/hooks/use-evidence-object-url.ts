import { useEffect } from "react";
import type { Actions } from "@/presenters/actions";
import { setUi } from "@/state/ui-store";

/**
 * The evidence viewer fetches a file only when the person asks (photos on open, video on request), through the authorized
 * endpoint with their credentials. The object URL lives only while the viewer is open and is revoked afterwards.
 */
export function useEvidenceObjectUrl(
  viewerId: string | undefined,
  requested: boolean,
  actions: Actions,
): void {
  useEffect(() => {
    if (!viewerId || !requested) return;
    let url: string | null = null;
    let live = true;
    actions.evidenceBlob(viewerId).then(
      (b) => {
        if (!live) return;
        url = URL.createObjectURL(b);
        setUi({ viewerUrl: url });
      },
      () => live && setUi({ viewerErr: true }),
    );
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [viewerId, requested, actions]);
}
