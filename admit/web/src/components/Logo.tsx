export function Logo({ size = 26, light }: { size?: number; light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="font-display font-black uppercase tracking-[0.02em]"
        style={{
          fontSize: size,
          fontStretch: "70%",
          color: light ? "var(--color-paper)" : "var(--color-ink)",
        }}
      >
        Admit
      </span>
      <span
        aria-hidden="true"
        className="rounded-full bg-brand"
        style={{ width: size * 0.35, height: size * 0.35 }}
      />
    </span>
  );
}
