import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

const button = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-btn font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary: "border border-border bg-surface text-foreground hover:bg-canvas",
        dark: "bg-foreground text-white hover:bg-primary",
        ghost: "text-body hover:bg-surface-subtle",
        link: "text-primary hover:underline",
        danger: "bg-danger text-white hover:opacity-90",
      },
      size: {
        sm: "h-7 px-2.5 text-[11px]",
        md: "h-[30px] px-3 text-[11px]",
        lg: "h-9 px-4 text-[12.5px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  asChild?: boolean;
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
      {asChild ? (
        children
      ) : (
        <>
          {icon && !loading && <Icon name={icon} size={14} />}
          {children}
        </>
      )}
    </Comp>
  );
});

export { button as buttonVariants };
