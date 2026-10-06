/* eslint-disable */
// Transpiled once from the approved Claude Design (Raqib.dc.html), now owned in this repo: colors come from @/styles/colors, fonts from @/styles/typography. Behavior belongs in presenters.
import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";

export function ModuleStub({ vm }: { vm: VM }) {
  const { pad, stub } = vm;
  return (
    <>
      <div style={{ padding: pad, maxWidth: "720px", margin: "24px auto" }}>
        <section
          style={{
            background: C.surface.white,
            border: `1px dashed ${C.border.strong}`,
            borderRadius: "6px",
            padding: "28px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <h1 style={{ margin: "0", fontSize: "20px", fontWeight: "600" }}>{stub.title}</h1>
          <div style={{ fontSize: "14px", color: C.text.body }}>{stub.body}</div>
          <div style={{ fontSize: "12px", color: C.text.muted, marginTop: "6px" }}>
            {stub.phase}
          </div>
        </section>
      </div>
    </>
  );
}
