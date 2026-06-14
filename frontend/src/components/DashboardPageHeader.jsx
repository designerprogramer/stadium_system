export default function DashboardPageHeader({ eyebrow, title, description, icon: Icon }) {
  return (
    <header className="surface p-5">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-semibold text-sky-600">{eyebrow}</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">{title}</h1>
          {description && <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>}
        </div>
        {Icon && (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
            <Icon className="h-6 w-6" />
          </div>
        )}
      </div>
    </header>
  );
}
