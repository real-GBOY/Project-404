interface AuthHeaderProps {
  title: string;
  subtitle?: string;
}

/** Title + optional subtitle above an auth form, inside the `AuthLayout` card. */
export function AuthHeader({ title, subtitle }: AuthHeaderProps) {
  return (
    <div className="mb-5 flex flex-col gap-1">
      <h1 className="text-[17px] font-extrabold tracking-tight text-foreground">{title}</h1>
      {subtitle && <p className="text-[13px] text-muted">{subtitle}</p>}
    </div>
  );
}
