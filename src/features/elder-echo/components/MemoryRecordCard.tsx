import type { CSSProperties } from 'react'
import { EchoCard } from './EchoCard'
import type { MemoryEchoCardVM } from '../types'

type MemoryRecordCardProps = {
  card: MemoryEchoCardVM
  expanded: boolean
  onExpandCard: (id: string) => void
  onContinueTalk: (id: string) => void
  onSnoozeMemory: (id: string) => void
}

export function MemoryRecordCard({
  card,
  expanded,
  onExpandCard,
  onContinueTalk,
  onSnoozeMemory,
}: MemoryRecordCardProps) {
  return (
    <EchoCard
      header={
        <div style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 13, color: '#334155' }}>{card.source}</span>
          <strong style={{ fontSize: 18, color: '#0f172a' }}>{card.topic}</strong>
          <span style={{ fontSize: 13, color: '#64748b' }}>{card.time}</span>
        </div>
      }
      summary={card.promptText}
      detail={card.detail}
      statusLabel={card.status === 'can_continue' ? '可继续聊' : '稍后再看'}
      statusTone={card.status === 'can_continue' ? 'neutral' : 'muted'}
      expanded={expanded}
      dimmed={card.status === 'snoozed'}
      onExpandCard={() => onExpandCard(card.id)}
      actions={
        <div style={{ display: 'grid', gap: 8 }}>
          <button type="button" onClick={() => onContinueTalk(card.id)} style={primaryButtonStyle}>
            从这里继续说
          </button>
          <button type="button" onClick={() => onSnoozeMemory(card.id)} style={secondaryButtonStyle}>
            标记稍后再看
          </button>
        </div>
      }
    />
  )
}

const primaryButtonStyle: CSSProperties = {
  border: '1px solid #0f766e',
  background: '#0f766e',
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
