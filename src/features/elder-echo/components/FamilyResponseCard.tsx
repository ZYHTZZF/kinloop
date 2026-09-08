import type { CSSProperties } from 'react'
import { EchoCard } from './EchoCard'
import type { FamilyEchoCardVM } from '../types'

type FamilyResponseCardProps = {
  card: FamilyEchoCardVM
  expanded: boolean
  onExpandCard: (id: string) => void
  onQuickReply: (card: FamilyEchoCardVM) => void
  onContinueTalk: (id: string) => void
  onPlayVoice: (id: string) => void
}

export function FamilyResponseCard({
  card,
  expanded,
  onExpandCard,
  onQuickReply,
  onContinueTalk,
  onPlayVoice,
}: FamilyResponseCardProps) {
  return (
    <EchoCard
      header={
        <div style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 13, color: '#334155' }}>{card.source}</span>
          <strong style={{ fontSize: 18, color: '#0f172a' }}>{card.title}</strong>
          <span style={{ fontSize: 13, color: '#64748b' }}>{card.time}</span>
        </div>
      }
      summary={card.summary}
      detail={card.detail}
      statusLabel={getFamilyStatusLabel(card.status)}
      statusTone={getFamilyStatusTone(card.status)}
      expanded={expanded}
      onExpandCard={() => onExpandCard(card.id)}
      actions={
        <div style={{ display: 'grid', gap: 8 }}>
          <button type="button" onClick={() => onQuickReply(card)} style={primaryButtonStyle}>
            回一句
          </button>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button type="button" onClick={() => onPlayVoice(card.id)} style={secondaryButtonStyle}>
              听一听
            </button>
            <button type="button" onClick={() => onContinueTalk(card.id)} style={secondaryButtonStyle}>
              继续聊
            </button>
          </div>
        </div>
      }
    />
  )
}

function getFamilyStatusLabel(status: FamilyEchoCardVM['status']) {
  if (status === 'new') return '新回应'
  if (status === 'viewed') return '已查看'
  return '已回应'
}

function getFamilyStatusTone(status: FamilyEchoCardVM['status']) {
  if (status === 'new') return 'info' as const
  if (status === 'viewed') return 'neutral' as const
  return 'success' as const
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
  color: '#0f172a',
  borderRadius: 10,
  minHeight: 42,
  fontSize: 15,
  cursor: 'pointer',
}
