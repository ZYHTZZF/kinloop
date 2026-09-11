const clockFormatter = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
})

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
})

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatClock(timestamp: number | null | undefined) {
  if (!timestamp) return '--:--'
  return clockFormatter.format(new Date(timestamp))
}

export function formatShortDate(timestamp: number | null | undefined) {
  if (!timestamp) return '-- / --'
  return dateFormatter.format(new Date(timestamp))
}

export function formatShortDateTime(timestamp: number | null | undefined) {
  if (!timestamp) return '--'
  return dateTimeFormatter.format(new Date(timestamp))
}
