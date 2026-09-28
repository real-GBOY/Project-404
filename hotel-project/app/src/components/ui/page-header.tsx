import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/** Screen title row from the design: 22px/800 heading with actions on the right. */
export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: { to: string; label: string };
}) {
  return (
    <div className="mb-[18px]">
      {back ? (
        <Link
          to={back.to}
          className="mb-3.5 inline-block text-small font-semibold text-primary hover:text-primary-strong"
        >
          ← {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-heading font-extrabold">{title}</h1>
          {subtitle ? <p className="m-0 mt-1 text-body text-muted">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2.5">{actions}</div> : null}
      </div>
    </div>
  );
}
