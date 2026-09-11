type PageStateProps = {
  title: string
  description: string
  variant?: 'default' | 'error'
}

export function PageState({
  title,
  description,
  variant = 'default',
}: PageStateProps) {
  return (
    <article className={`state-panel state-panel--${variant}`}>
      <strong>{title}</strong>
      <p>{description}</p>
    </article>
  )
}
