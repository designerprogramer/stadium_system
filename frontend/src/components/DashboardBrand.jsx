export default function DashboardBrand({ workspace }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-slate-950">Mogadishu Stadium</p>
        <p className="hidden truncate text-xs font-medium text-slate-500 sm:block">{workspace} workspace</p>
      </div>
    </div>
  );
}
