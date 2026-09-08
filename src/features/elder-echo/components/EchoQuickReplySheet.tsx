import type { EchoQuickReplyOption, FamilyEchoCardVM } from '../types'

type EchoQuickReplySheetProps = {
  open: boolean
  card: FamilyEchoCardVM | null
  options: EchoQuickReplyOption[]
  onQuickReply: (cardId: string, reply: string) => void
  onClose: () => void
}

export function EchoQuickReplySheet({ open, card, options, onQuickReply, onClose }: EchoQuickReplySheetProps) {
  if (!open || !card) {
    return null
  }

  return (
    <section
      style={{
        border: '1px solid #bfdbfe',
        background: '#eff6ff',
        borderRadius: 14,
        padding: 14,
        display: 'grid',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <strong style={{ fontSize: 16, color: '#1e3a8a' }}>回一句</strong>
        <button
          type="button"
          onClick={onClose}
          style={{ border: 'none', background: 'none', color: '#1d4ed8', cursor: 'pointer', fontSize: 14 }}
        >
          关闭
        </button>
      </div>

      <p style={{ margin: 0, color: '#334155' }}>给「{card.source}」快速回复一句：</p>

      <div style={{ display: 'grid', gap: 8 }}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onQuickReply(card.id, option.label)}
            style={{
              border: '1px solid #93c5fd',
              background: '#ffffff',
              color: '#0f172a',
              borderRadius: 10,
              minHeight: 42,
              textAlign: 'left',
              padding: '8px 10px',
              cursor: 'pointer',
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  )
}
