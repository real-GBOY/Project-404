interface AuthHeaderProps {
  title: string;
  subtitle?: string;
}

/** Title + optional subtitle above an auth form, inside the `AuthLayout` card. */
export function AuthHeader({ title, subtitle }: AuthHeaderProps) {
  return (
    <div className="mb-5 flex flex-col gap-1.5">
      <h1 className="font-display text-[21px] font-medium leading-tight tracking-[0.005em] text-foreground">
        {title}
      </h1>
      {subtitle && <p className="text-[13px] text-muted">{subtitle}</p>}
    </div>
  );
}
