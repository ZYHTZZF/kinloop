import type { ReactNode } from 'react'
import type { SiteView } from '../../app/types'

type ViewOption = {
  id: SiteView
  label: string
  note: string
}

type WorkspaceShellProps = {
  activeView: SiteView
  onViewChange: (view: SiteView) => void
  viewOptions: ViewOption[]
  title: string
  subtitle: string
  children: ReactNode
}

export function WorkspaceShell({
  activeView,
  onViewChange,
  viewOptions,
  title,
  subtitle,
  children,
}: WorkspaceShellProps) {
  return (
    <main className="workspace">
      <header className="workspace__header">
        <div>
          <p className="workspace__eyebrow">Kinloop · Modular MVP</p>
          <h1>{title}</h1>
          <p className="workspace__subtitle">{subtitle}</p>
        </div>

        <div className="workspace__switcher" role="tablist" aria-label="切换端视图">
          {viewOptions.map((option) => (
            <button
              key={option.id}
              className={`workspace__switch ${activeView === option.id ? 'is-active' : ''}`}
              type="button"
              onClick={() => onViewChange(option.id)}
            >
              <strong>{option.label}</strong>
              <span>{option.note}</span>
            </button>
          ))}
        </div>
      </header>

      {children}
    </main>
  )
}
