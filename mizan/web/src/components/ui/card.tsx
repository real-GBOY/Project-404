import { forwardRef } from "react";
import { cn } from "@/lib/cn";

/**
 * The card — the prototype's universal surface:
 * `background:#fff; border:1px solid #ECECF1; border-radius:14px`. No shadow.
 * Compose with `CardHeader` / `CardTitle` / `CardBody`, or drop children in
 * directly with `overflow-hidden` when the card holds a flush list/table.
 */
export const Card = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function Card(
  { className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      data-slot="card"
      className={cn("rounded-card border border-border bg-surface", className)}
      {...props}
    />
  );
});

/** Flush card header — `padding:14–15px 18px; border-bottom:1px solid #F2F2F6`. */
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "flex items-center gap-2.5 border-b border-divider px-[18px] py-[15px]",
        className,
      )}
      {...props}
    />
  );
}

/** Section title — `font-size:14px; font-weight:800`. */
export function CardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      data-slot="card-title"
      className={cn("text-[14px] font-extrabold text-foreground", className)}
      {...props}
    >
      {children}
    </h3>
  );
}

/** Padded card body — the prototype's panels use `padding:18px`. */
export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="card-body" className={cn("p-[18px]", className)} {...props} />;
}
