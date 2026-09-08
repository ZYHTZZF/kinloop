import type { CSSProperties } from 'react'
import { EvidencePanel } from './EvidencePanel'
import { RiskBadge } from './RiskBadge'
import type { RecentStatusCardVM } from '../types'

type StatusCardProps = {
  card: RecentStatusCardVM
  expanded: boolean
  onToggleEvidence: (id: string) => void
  onStatusAction: (id: string) => void
  onMarkDone: (id: string) => void
}

export function StatusCard({ card, expanded, onToggleEvidence, onStatusAction, onMarkDone }: StatusCardProps) {
  const processLabel =
    card.processState === 'todo' ? '待处理' : card.processState === 'doing' ? '处理中' : '已处理'

  return (
    <article
      style={{
        border: card.processState === 'done' ? '1px solid #bbf7d0' : '1px solid #dbeafe',
        background: card.processState === 'done' ? '#f0fdf4' : '#ffffff',
        borderRadius: 14,
        padding: 14,
        opacity: card.processState === 'done' ? 0.85 : 1,
        display: 'grid',
        gap: 10,
      }}
    >
      <button
        type="button"
        onClick={() => onToggleEvidence(card.id)}
        style={{
          border: 'none',
          background: 'none',
          padding: 0,
          display: 'grid',
          gap: 8,
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#64748b', fontSize: 13 }}>{card.time}</span>
          <RiskBadge level={card.level} />
        </div>
        <strong style={{ color: '#0f172a', fontSize: 18 }}>{card.title}</strong>
        <p style={{ margin: 0, color: '#475569', lineHeight: 1.5 }}>{card.description}</p>
      </button>

      <section style={{ borderRadius: 10, background: '#f8fafc', padding: '8px 10px' }}>
        <strong style={{ color: '#334155', fontSize: 14 }}>联系原因</strong>
        <p style={{ margin: '6px 0 0 0', color: '#475569' }}>{card.reason}</p>
      </section>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ color: '#475569' }}>当前处理：{processLabel}</span>
        <button type="button" onClick={() => onToggleEvidence(card.id)} style={plainButtonStyle}>
          {expanded ? '收起依据' : '查看依据'}
        </button>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <button type="button" onClick={() => onStatusAction(card.id)} style={primaryButtonStyle}>
          {getPrimaryActionLabel(card.suggestedAction)}
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button type="button" onClick={() => onToggleEvidence(card.id)} style={secondaryButtonStyle}>
            {expanded ? '收起依据' : '查看依据'}
          </button>
          <button type="button" onClick={() => onMarkDone(card.id)} style={secondaryButtonStyle}>
            标记已处理
          </button>
        </div>
      </div>

      <EvidencePanel evidence={card.evidence} expanded={expanded} />
    </article>
  )
}

function getPrimaryActionLabel(action: RecentStatusCardVM['suggestedAction']) {
  if (action === 'voice') return '发语音'
  if (action === 'call') return '打电话'
  return '安排回访'
}

const primaryButtonStyle: CSSProperties = {
  border: '1px solid #2563eb',
  background: '#2563eb',
  color: '#ffffff',
  borderRadius: 10,
  minHeight: 44,
  fontSize: 16,
  fontWeight: 700,
  cursor: 'pointer',
}

const secondaryButtonStyle: CSSProperties = {
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#334155',
  borderRadius: 10,
  minHeight: 42,
  fontSize: 15,
  cursor: 'pointer',
}

const plainButtonStyle: CSSProperties = {
  border: 'none',
  background: 'none',
  color: '#2563eb',
  padding: 0,
  fontSize: 14,
  cursor: 'pointer',
}
