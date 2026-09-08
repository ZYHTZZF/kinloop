type EvidencePanelProps = {
  evidence: string[]
  expanded: boolean
}

export function EvidencePanel({ evidence, expanded }: EvidencePanelProps) {
  if (!expanded) {
    return null
  }

  return (
    <section
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        background: '#f8fafc',
        padding: '10px 12px',
        display: 'grid',
        gap: 6,
      }}
    >
      <strong style={{ fontSize: 14, color: '#334155' }}>本地依据摘要</strong>
      {evidence.map((item) => (
        <p key={item} style={{ margin: 0, color: '#475569', lineHeight: 1.5 }}>
          - {item}
        </p>
      ))}
    </section>
  )
}
