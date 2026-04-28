/**
 * PageHeader — Standard page title bar for Analytics, Campaigns, Settings.
 *
 * Props:
 *   title: string — Page title
 *   subtitle?: string — Optional description below title
 *   actions?: ReactNode — Slot for buttons (export, sync, etc.) aligned right
 */
export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <h1 className="font-headline text-2xl font-bold text-on-surface">{title}</h1>
        {subtitle && (
          <p className="text-sm text-on-surface-variant mt-1">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-3 ml-4 shrink-0">{actions}</div>
      )}
    </div>
  );
}
