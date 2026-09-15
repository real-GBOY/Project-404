import { cn } from "@/lib/cn";

export interface AvatarProps {
  name: string;
  size?: number;
  variant?: "dark" | "brand";
  className?: string;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Square initials avatar (the identity has no rounding) — graphite for the current user, pale-ochre for entities/agents. */
export function Avatar({ name, size = 24, variant = "brand", className }: AvatarProps) {
  return (
    <div
      className={cn(
        "flex flex-none items-center justify-center font-bold",
        variant === "dark" ? "bg-foreground text-white" : "bg-primary-surface text-primary",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.4) }}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </div>
  );
}
