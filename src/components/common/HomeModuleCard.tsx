import type { ReactNode } from 'react'

type HomeModuleCardProps = {
  title: string
  subtitle: string
  owner: string
  path: string
  actionLabel: string
  children: ReactNode
}

export function HomeModuleCard({
  title,
  subtitle,
  owner,
  path,
  actionLabel,
  children,
}: HomeModuleCardProps) {
  return (
    <article className="module-card">
      <header className="module-card__header">
        <div>
          <p className="module-card__subtitle">{subtitle}</p>
          <h2>{title}</h2>
        </div>
        <span className="module-card__action">{actionLabel}</span>
      </header>

      <div className="module-card__body">{children}</div>

      <footer className="module-card__footer">
        <span>Owner: {owner}</span>
        <code>{path}</code>
      </footer>
    </article>
  )
}
