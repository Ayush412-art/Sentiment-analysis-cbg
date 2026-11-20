import { MenuIcon } from './Icons';

export default function Header({ title, subtitle, onMenuClick, actions }) {
  return (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="mt-1 rounded p-1.5 text-slate-600 hover:bg-slate-200 lg:hidden"
          aria-label="Open navigation"
        >
          <MenuIcon />
        </button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
