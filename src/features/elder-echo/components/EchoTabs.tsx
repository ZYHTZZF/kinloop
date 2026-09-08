import type { CSSProperties } from 'react'
import type { EchoTabType } from '../types'

type EchoTabsProps = {
  activeTab: EchoTabType
  onChangeTab: (tab: EchoTabType) => void
}

export function EchoTabs({ activeTab, onChangeTab }: EchoTabsProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <button
        type="button"
        onClick={() => onChangeTab('family')}
        style={getTabStyle(activeTab === 'family')}
      >
        家人回应
      </button>
      <button
        type="button"
        onClick={() => onChangeTab('memory')}
        style={getTabStyle(activeTab === 'memory')}
      >
        我的回忆 / 关心记录
      </button>
    </div>
  )
}

function getTabStyle(active: boolean): CSSProperties {
  return {
    border: active ? '2px solid #2563eb' : '1px solid #cbd5e1',
    borderRadius: 12,
    background: active ? '#eff6ff' : '#ffffff',
    color: active ? '#1d4ed8' : '#0f172a',
    fontSize: 16,
    fontWeight: active ? 700 : 500,
    minHeight: 52,
    padding: '10px 12px',
    cursor: 'pointer',
    textAlign: 'center',
  }
}
