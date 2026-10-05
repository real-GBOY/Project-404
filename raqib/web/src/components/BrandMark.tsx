import { C } from "@/styles/colors";

/** The Raqib square mark: the brand letter on court green. */
export function BrandMark({ letter, size = 40 }: { letter: string; size?: number }) {
  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        background: C.brand.primary,
        borderRadius: 4,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: C.surface.white,
        fontWeight: 700,
        fontSize: Math.round(size / 2),
      }}
    >
      {letter}
    </div>
  );
}
