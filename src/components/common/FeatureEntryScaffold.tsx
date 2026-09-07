import type { ReactNode } from 'react'

type FeatureEntryScaffoldProps = {
  eyebrow: string
  title: string
  summary: string
  owner: string
  path: string
  notes: string[]
  onBack: () => void
  children?: ReactNode
}

export function FeatureEntryScaffold({
  eyebrow,
  title,
  summary,
  owner,
  path,
  notes,
  onBack,
  children,
}: FeatureEntryScaffoldProps) {
  return (
    <section className="feature-entry">
      <header className="feature-entry__header">
        <button className="feature-entry__back" type="button" onClick={onBack}>
          返回首页
        </button>

        <div className="feature-entry__intro">
          <p className="page-shell__eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p>{summary}</p>
        </div>
      </header>

      <div className="feature-entry__grid">
        <article className="feature-entry__panel">
          <strong>开发接口已预留</strong>
          <p>这个页面现在只承担模块入口和占位壳子，后续功能可以直接在本模块目录内继续展开。</p>
          {children ? <div className="stack-list">{children}</div> : null}
        </article>

        <article className="feature-entry__panel">
          <strong>开发边界</strong>
          <div className="feature-entry__meta">
            <span>Owner: {owner}</span>
            <code>{path}</code>
          </div>
          <div className="stack-list">
            {notes.map((note) => (
              <article className="list-panel" key={note}>
                <p>{note}</p>
              </article>
            ))}
          </div>
        </article>
      </div>
    </section>
  )
}
