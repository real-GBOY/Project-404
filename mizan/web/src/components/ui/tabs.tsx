import { forwardRef } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/cn";

export const Tabs = TabsPrimitive.Root;

/**
 * Underline tab strip — client / matter / invoice detail pages.
 * `display:flex; gap:26px; border-bottom:1px solid #E9E9EF; padding-inline:4px`.
 */
export const TabsList = forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function TabsList({ className, ...props }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      data-slot="tabs-list"
      className={cn(
        "flex items-center gap-[26px] overflow-x-auto border-b border-border-tab px-1",
        className,
      )}
      {...props}
    />
  );
});

/**
 * Active: `font-weight:800; color:#4A2D1F; border-bottom:2.5px solid #3B2418`.
 * Idle: `font-weight:600; color:#7A7A90`.
 */
export const TabsTrigger = forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      data-slot="tabs-trigger"
      className={cn(
        "-mb-px shrink-0 whitespace-nowrap border-b-[2.5px] border-transparent px-0.5 pb-3 text-[13.5px] font-semibold text-muted-2 transition-colors",
        "hover:text-foreground",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        "data-[state=active]:border-primary data-[state=active]:font-extrabold data-[state=active]:text-link",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});

export const TabsContent = forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      data-slot="tabs-content"
      className={cn(
        "pt-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        className,
      )}
      {...props}
    />
  );
});
