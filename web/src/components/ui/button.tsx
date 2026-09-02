import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

const button = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-bold transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary: "border border-border-control bg-surface text-foreground hover:bg-surface-subtle",
        sand: "border border-border-accent bg-surface-sand text-link hover:bg-surface-sand-hover",
        ghost: "text-foreground-body hover:bg-surface-subtle",
        danger: "bg-danger text-white hover:bg-danger/90",
        link: "text-link underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-[12.5px]",
        md: "h-9 px-4 text-[13px]",
        lg: "h-10 px-5 text-[13.5px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  asChild?: boolean;
  /** Material Symbols name shown before the label. */
  icon?: string;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, icon, loading = false, children, disabled, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      className={cn(button({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <Icon name="progress_activity" size={16} className="animate-spin" />
      ) : (
        icon && <Icon name={icon} size={16} />
      )}
      {children}
    </Comp>
  );
});

export { button as buttonVariants };
