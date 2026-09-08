import type { RecentStatusLevel } from '../types'

type RiskBadgeProps = {
  level: RecentStatusLevel
}

export function RiskBadge({ level }: RiskBadgeProps) {
  const label = level === 'priority' ? '优先' : level === 'attention' ? '关注' : '提醒'
  const style =
    level === 'priority'
      ? { background: '#fee2e2', color: '#b91c1c' }
      : level === 'attention'
        ? { background: '#fef3c7', color: '#92400e' }
        : { background: '#dbeafe', color: '#1d4ed8' }

  return (
    <span
      style={{
        ...style,
        borderRadius: 999,
        fontSize: 12,
        padding: '4px 10px',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}
