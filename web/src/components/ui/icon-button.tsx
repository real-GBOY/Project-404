import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

const iconButton = cva(
  "inline-flex items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
  {
    variants: {
      variant: {
        ghost: "text-foreground-body hover:bg-surface-subtle",
        outline: "border border-border-control text-foreground-body hover:bg-surface-subtle",
      },
      size: {
        sm: "size-8",
        md: "size-9",
      },
    },
    defaultVariants: { variant: "ghost", size: "md" },
  },
);

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label">,
    VariantProps<typeof iconButton> {
  icon: string;
  /** required — an icon-only control must be labelled for screen readers */
  "aria-label": string;
  iconSize?: number;
  filled?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, variant, size, icon, iconSize = 18, filled, ...props },
  ref,
) {
  return (
    <button ref={ref} type="button" className={cn(iconButton({ variant, size }), className)} {...props}>
      <Icon name={icon} size={iconSize} filled={filled} />
    </button>
  );
});
