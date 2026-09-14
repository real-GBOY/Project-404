import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  "aria-label": string;
  size?: number;
}

/** Bordered square icon button — header menu/search/bell, drawer close, etc. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, size = 15, className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "flex size-8 flex-none items-center justify-center rounded-btn border border-border text-body transition-colors hover:bg-canvas disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
      {...props}
    >
      <Icon name={icon} size={size} />
    </button>
  );
});
