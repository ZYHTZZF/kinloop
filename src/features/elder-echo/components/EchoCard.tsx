import type { CSSProperties, ReactNode } from 'react'

type EchoCardProps = {
  header: ReactNode
  statusLabel: string
  statusTone: 'info' | 'neutral' | 'success' | 'muted'
  summary: string
  detail?: string
  expanded: boolean
  dimmed?: boolean
  onExpandCard: () => void
  actions: ReactNode
}

export function EchoCard({
  header,
  statusLabel,
  statusTone,
  summary,
  detail,
  expanded,
  dimmed,
  onExpandCard,
  actions,
}: EchoCardProps) {
  return (
    <article
      style={{
        border: '1px solid #dbeafe',
        borderRadius: 14,
        background: dimmed ? '#f8fafc' : '#ffffff',
        opacity: dimmed ? 0.6 : 1,
        padding: 14,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'start' }}>
        <div>{header}</div>
        <span style={getStatusStyle(statusTone)}>{statusLabel}</span>
      </div>

      <p style={{ marginTop: 10, marginBottom: 0, color: '#334155', lineHeight: 1.5 }}>{summary}</p>

      <button
        type="button"
        onClick={onExpandCard}
        style={{
          marginTop: 8,
          border: 'none',
          background: 'none',
          color: '#2563eb',
          padding: 0,
          fontSize: 14,
          cursor: 'pointer',
        }}
      >
        {expanded ? '收起详情' : '展开详情'}
      </button>

      {expanded ? (
        <div
          style={{
            marginTop: 10,
            borderRadius: 10,
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            padding: '10px 12px',
            color: '#475569',
            lineHeight: 1.5,
          }}
        >
          {detail}
        </div>
      ) : null}

      <div style={{ marginTop: 12 }}>{actions}</div>
    </article>
  )
}

function getStatusStyle(tone: EchoCardProps['statusTone']): CSSProperties {
  const styles: Record<EchoCardProps['statusTone'], CSSProperties> = {
    info: { background: '#dbeafe', color: '#1d4ed8' },
    neutral: { background: '#e2e8f0', color: '#334155' },
    success: { background: '#dcfce7', color: '#166534' },
    muted: { background: '#f1f5f9', color: '#64748b' },
  }

  return {
    ...styles[tone],
    borderRadius: 999,
    fontSize: 12,
    padding: '4px 10px',
    whiteSpace: 'nowrap',
  }
}
