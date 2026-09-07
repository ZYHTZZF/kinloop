import type { ReactNode } from 'react'

type HomeModuleCardProps = {
  title: string
  subtitle: string
  owner: string
  path: string
  actionLabel: string
  onAction: () => void
  children: ReactNode
}

export function HomeModuleCard({
  title,
  subtitle,
  owner,
  path,
  actionLabel,
  onAction,
  children,
}: HomeModuleCardProps) {
  return (
    <article className="module-card">
      <header className="module-card__header">
        <div>
          <p className="module-card__subtitle">{subtitle}</p>
          <h2>{title}</h2>
        </div>
        <button className="module-card__action" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      </header>

      <div className="module-card__body">{children}</div>

      <footer className="module-card__footer">
        <span>Owner: {owner}</span>
        <code>{path}</code>
      </footer>
    </article>
  )
}
