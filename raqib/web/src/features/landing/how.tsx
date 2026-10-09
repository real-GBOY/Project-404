import { C } from "@/styles/colors";
import type { Copy } from "./copy-types";
import { AnswerRow, Band, cell, HATCH, Heading, Ltr, type Layout } from "./ui";

const stepCard = (last: boolean): React.CSSProperties => ({
  padding: "22px 20px",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  borderInlineEnd: last ? undefined : `1px solid ${C.surface.track}`,
  borderBottom: `1px solid ${C.surface.track}`,
});

function StepHead({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Ltr
          style={{
            fontSize: 12,
            color: C.surface.white,
            background: C.text.ink,
            borderRadius: 3,
            padding: "1px 7px",
          }}
        >{`0${n}`}</Ltr>
        <span style={{ fontWeight: 700, fontSize: 18 }}>{title}</span>
      </div>
      <p style={{ margin: 0, fontSize: 14.5, color: C.text.body, textWrap: "pretty" }}>{text}</p>
    </>
  );
}

const sample: React.CSSProperties = { marginTop: "auto" };

export function How({ c, L }: { c: Copy; L: Layout }) {
  const [s1, s2, s3, s4] = c.steps;
  const m = c.m;
  const box: React.CSSProperties = {
    ...sample,
    border: `1px solid ${C.surface.track}`,
    borderRadius: 4,
    padding: "10px 12px",
    fontSize: 12.5,
    display: "flex",
    flexDirection: "column",
    gap: 4,
    background: C.surface.paper,
  };
  const thumb: React.CSSProperties = {
    width: 56,
    height: 42,
    border: `1px solid ${C.border.hairline}`,
    borderRadius: 3,
    background: HATCH(6),
  };
  const action = (primary: boolean): React.CSSProperties => ({
    height: 34,
    borderRadius: 4,
    fontSize: 12.5,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    ...(primary
      ? { background: C.brand.primary, color: C.surface.white, fontWeight: 500 }
      : {
          border: `1px solid ${C.status.warning.borderStrong}`,
          color: C.status.warning.fg,
          background: C.surface.white,
        }),
  });
  return (
    <Band id="how" L={L} gap={36}>
      <Heading L={L} eyebrow={c.howEyebrow} title={c.howTitle} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,250px),1fr))",
          border: `1px solid ${C.border.hairline}`,
          borderRadius: 6,
          background: C.surface.white,
          overflow: "hidden",
        }}
      >
        <div style={stepCard(false)}>
          <StepHead n={1} title={cell(s1 ?? [], 0)} text={cell(s1 ?? [], 1)} />
          <div style={box}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <Ltr style={{ color: C.text.secondary }}>VIS-26-0418</Ltr>
              <span style={{ color: C.status.info.fg, fontWeight: 500 }}>{c.assigned}</span>
            </div>
            <div style={{ fontWeight: 500 }}>{cell(c.stepSample, 0)}</div>
            <div style={{ color: C.text.muted }}>{cell(c.stepSample, 1)}</div>
          </div>
        </div>
        <div style={stepCard(false)}>
          <StepHead n={2} title={cell(s2 ?? [], 0)} text={cell(s2 ?? [], 1)} />
          <div style={sample}>
            <AnswerRow labels={[m.c, m.nc, m.na]} pick={0} height={38} size={12.5} />
          </div>
        </div>
        <div style={stepCard(false)}>
          <StepHead n={3} title={cell(s3 ?? [], 0)} text={cell(s3 ?? [], 1)} />
          <div style={{ ...sample, display: "flex", gap: 6, alignItems: "center" }}>
            <span style={thumb} />
            <span style={thumb} />
            <span style={{ fontSize: 12, color: C.text.secondary }}>{c.s3x}</span>
          </div>
        </div>
        <div style={stepCard(true)}>
          <StepHead n={4} title={cell(s4 ?? [], 0)} text={cell(s4 ?? [], 1)} />
          <div style={{ ...sample, display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={action(true)}>{c.s4a}</span>
            <span style={action(false)}>{c.s4b}</span>
          </div>
        </div>
      </div>
    </Band>
  );
}
