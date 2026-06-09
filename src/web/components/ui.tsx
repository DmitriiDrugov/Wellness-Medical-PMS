import Link from "next/link";

export function Icon({ name, className }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className ?? ""}`}>{name}</span>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-on-surface">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-on-surface-variant">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={`card p-5 ${className ?? ""}`}>{children}</div>;
}

type Tone = "success" | "warning" | "info" | "neutral" | "primary";
export function StatusPill({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function StatCard({
  label,
  value,
  icon,
  trend,
}: {
  label: string;
  value: string;
  icon?: string;
  trend?: string;
}) {
  return (
    <Card className="flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">{label}</p>
        <p className="mt-2 text-3xl font-semibold text-on-surface">{value}</p>
        {trend && <p className="mt-1 text-xs text-on-surface-variant">{trend}</p>}
      </div>
      {icon && (
        <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
          <Icon name={icon} />
        </span>
      )}
    </Card>
  );
}

/** Renders loading / error / empty states uniformly; otherwise renders children. */
export function DataState({
  loading,
  error,
  empty,
  emptyLabel = "No records found.",
  children,
}: {
  loading: boolean;
  error?: string | null;
  empty?: boolean;
  emptyLabel?: string;
  children: React.ReactNode;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 py-12 text-on-surface-variant">
        <Icon name="progress_activity" className="animate-spin" />
        Loading…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-error-container/60 px-4 py-3 text-on-error-container">
        <Icon name="error" />
        {error}
      </div>
    );
  }
  if (empty) {
    return <div className="py-12 text-center text-on-surface-variant">{emptyLabel}</div>;
  }
  return <>{children}</>;
}

export function StubBanner({ feature, phase }: { feature: string; phase: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-[#7a4f17]">
      <Icon name="construction" />
      <div>
        <p className="font-semibold">{feature} — backend not yet implemented</p>
        <p className="text-[#7a4f17]/80">
          This screen is part of {phase}. The UI is wired and ready; data and actions activate once the
          backend phase is built.
        </p>
      </div>
    </div>
  );
}

export function LinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="btn-secondary">
      {children}
    </Link>
  );
}
