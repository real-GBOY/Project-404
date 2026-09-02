import { forwardRef, useMemo } from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const avatar = cva(
  "relative inline-flex flex-none select-none items-center justify-center overflow-hidden rounded-full bg-surface-sand font-bold text-link",
  {
    variants: {
      size: {
        xs: "size-6 text-[10px]",
        sm: "size-8 text-[11px]",
        md: "size-9 text-[12px]",
        lg: "size-11 text-[14px]",
      },
    },
    defaultVariants: { size: "md" },
  },
);

export interface AvatarProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof avatar> {
  name: string;
  src?: string;
}

/** Initials-first avatar; shows the image once it loads. */
export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(function Avatar(
  { className, size, name, src, ...props },
  ref,
) {
  const initials = useMemo(() => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  }, [name]);

  return (
    <AvatarPrimitive.Root
      ref={ref}
      data-slot="avatar"
      className={cn(avatar({ size }), className)}
      {...props}
    >
      {src && (
        <AvatarPrimitive.Image src={src} alt={name} className="size-full object-cover" />
      )}
      <AvatarPrimitive.Fallback className="flex size-full items-center justify-center" delayMs={src ? 300 : 0}>
        {initials}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
});
