import { getDatabase } from '../db/index.mjs'

const DAY_MS = 24 * 60 * 60 * 1000
const WINDOW_DAYS = 7
const EMOTION_WINDOW_MS = WINDOW_DAYS * DAY_MS

function mapPulse(row) {
  return {
    id: row.id,
    familySpaceId: row.familySpaceId,
    sourceType: row.sourceType,
    pulseType: row.pulseType,
    severity: row.severity,
    summary: row.summary,
    sourceConversationId: row.sourceConversationId,
    sourceMessageId: row.sourceMessageId,
    sourceExcerpt: row.sourceExcerpt,
    emotionSource: row.emotionSource,
    emotionLabel: row.emotionLabel,
    emotionMode: row.emotionMode,
    status: row.status,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
  }
}

export function listTodayPulses() {
  const db = getDatabase()
  return db.prepare(`
    select
      id,
      family_space_id as familySpaceId,
      source_type as sourceType,
      pulse_type as pulseType,
      severity,
      summary,
      source_conversation_id as sourceConversationId,
      source_message_id as sourceMessageId,
      source_excerpt as sourceExcerpt,
      emotion_source as emotionSource,
      emotion_label as emotionLabel,
      emotion_mode as emotionMode,
      status,
      created_at as createdAt,
      resolved_at as resolvedAt
    from pulses
    order by created_at desc
  `).all().map(mapPulse)
}

export function listPulseHistory() {
  return listTodayPulses()
}

export function getTodayEmotionSummary() {
  const emotionPulses = listPulseHistory().filter((pulse) => pulse.pulseType === 'Emotion')
  const now = Date.now()
  const threshold = now - EMOTION_WINDOW_MS
  const weeklyEmotionPulses = emotionPulses.filter((pulse) => Number(pulse.createdAt ?? 0) >= threshold)
  const abnormalPulses = weeklyEmotionPulses
    .filter((pulse) => pulse.severity !== 'LOW')
    .sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0))

  return {
    generatedAt: now,
    windowDays: WINDOW_DAYS,
    totalEmotionCount: weeklyEmotionPulses.length,
    abnormalCount: abnormalPulses.length,
    stableSummary: buildStableSummary(weeklyEmotionPulses, abnormalPulses),
    trend: buildTrendPoints(weeklyEmotionPulses, now),
    abnormalCards: abnormalPulses.slice(0, 3).map(buildAbnormalCard),
    sourceBreakdown: buildSourceBreakdown(weeklyEmotionPulses),
  }
}

export function createPulse(payload) {
  const db = getDatabase()
  const now = Date.now()
  const id = payload.id ?? `pulse_${now}_${Math.floor(Math.random() * 10000)}`

  db.prepare(`
    insert into pulses (
      id, family_space_id, source_type, pulse_type, severity, summary,
      source_conversation_id, source_message_id, source_excerpt, emotion_source, emotion_label,
      emotion_mode,
      status, created_at, resolved_at
    ) values (
      $id, $familySpaceId, $sourceType, $pulseType, $severity, $summary,
      $sourceConversationId, $sourceMessageId, $sourceExcerpt, $emotionSource, $emotionLabel,
      $emotionMode,
      $status, $createdAt, $resolvedAt
    )
  `).run({
    id,
    familySpaceId: payload.familySpaceId,
    sourceType: payload.sourceType ?? 'AI',
    pulseType: payload.pulseType ?? 'Emotion',
    severity: payload.severity ?? 'LOW',
    summary: payload.summary ?? '',
    sourceConversationId: payload.sourceConversationId ?? null,
    sourceMessageId: payload.sourceMessageId ?? null,
    sourceExcerpt: payload.sourceExcerpt ?? null,
    emotionSource: payload.emotionSource ?? null,
    emotionLabel: payload.emotionLabel ?? null,
    emotionMode: payload.emotionMode ?? null,
    status: payload.status ?? 'OPEN',
    createdAt: payload.createdAt ?? now,
    resolvedAt: payload.resolvedAt ?? null,
  })

  const pulse = db.prepare(`
    select
      id,
      family_space_id as familySpaceId,
      source_type as sourceType,
      pulse_type as pulseType,
      severity,
      summary,
      source_conversation_id as sourceConversationId,
      source_message_id as sourceMessageId,
      source_excerpt as sourceExcerpt,
      emotion_source as emotionSource,
      emotion_label as emotionLabel,
      emotion_mode as emotionMode,
      status,
      created_at as createdAt,
      resolved_at as resolvedAt
    from pulses
    where id = ?
  `).get(id)

  return mapPulse(pulse)
}

function buildTrendPoints(pulses, now) {
  const dayMap = new Map()

  for (let offset = WINDOW_DAYS - 1; offset >= 0; offset -= 1) {
    const date = new Date(now - offset * DAY_MS)
    const dayKey = toDayKey(date)
    dayMap.set(dayKey, {
      dayKey,
      dateLabel: formatMonthDay(date),
      pulses: [],
    })
  }

  for (const pulse of pulses) {
    const dayKey = toDayKey(new Date(pulse.createdAt))
    const bucket = dayMap.get(dayKey)
    if (bucket) {
      bucket.pulses.push(pulse)
    }
  }

  return [...dayMap.values()].map((bucket) => {
    const dominantLabel = pickDominantLabel(bucket.pulses)
    const highestSeverity = pickHighestSeverity(bucket.pulses)
    const abnormalCount = bucket.pulses.filter((pulse) => pulse.severity !== 'LOW').length
    return {
      dayKey: bucket.dayKey,
      dateLabel: bucket.dateLabel,
      dominantLabel,
      dominantLabelText: toEmotionLabelText(dominantLabel),
      highestSeverity,
      totalCount: bucket.pulses.length,
      abnormalCount,
      summary: buildTrendSummary(bucket.pulses, dominantLabel, abnormalCount),
    }
  })
}

function buildTrendSummary(pulses, dominantLabel, abnormalCount) {
  if (pulses.length === 0) {
    return '这一天没有新的情绪线索，建议保持日常联系节奏。'
  }

  if (abnormalCount > 0) {
    return `这一天出现 ${abnormalCount} 条需要优先关注的情绪变化，建议主动问候并确认近况。`
  }

  if (dominantLabel === 'positive' || dominantLabel === 'calm') {
    return '这一天整体表达较平稳，可以延续轻松交流和日常陪伴。'
  }

  if (dominantLabel === 'neutral' || dominantLabel === 'steady') {
    return '这一天情绪线索较稳定，适合保持规律联系。'
  }

  return '这一天有一些情绪起伏，建议在下次联系时多留一点回应空间。'
}

function buildAbnormalCard(pulse) {
  return {
    pulseId: pulse.id,
    summary: pulse.summary,
    severity: pulse.severity,
    severityLabel: toSeverityLabel(pulse.severity),
    source: normalizeSource(pulse.emotionSource),
    sourceLabel: toSourceLabel(normalizeSource(pulse.emotionSource)),
    emotionLabel: pulse.emotionLabel ?? null,
    happenedAt: pulse.createdAt,
    sourceConversationId: pulse.sourceConversationId ?? null,
    sourceExcerpt: pulse.sourceExcerpt ?? null,
    attentionSuggestion: buildAttentionSuggestion(pulse),
    actionSuggestion: buildActionSuggestion(pulse),
    status: pulse.status,
  }
}

function buildAttentionSuggestion(pulse) {
  const sourceLabel = toSourceLabel(normalizeSource(pulse.emotionSource))
  if (pulse.severity === 'HIGH') {
    return `${sourceLabel}里出现了明显波动，建议家人优先确认当下状态和是否需要陪伴。`
  }

  if (pulse.emotionLabel === 'sad' || pulse.emotionLabel === 'anxious') {
    return `${sourceLabel}里有持续低落或紧张的线索，适合先接住情绪，再继续了解原因。`
  }

  return `${sourceLabel}提示今天比平时更需要回应，适合尽快发起一次温和联系。`
}

function buildActionSuggestion(pulse) {
  if (pulse.sourceConversationId) {
    return '先查看原聊天，再决定由谁跟进记录，尽量在今天完成一次回应。'
  }

  if (pulse.severity === 'HIGH') {
    return '建议由一位家人尽快主动联系，并在状态页记录跟进结果。'
  }

  return '建议安排一次简短问候，并在状态页补充本次跟进结果。'
}

function buildSourceBreakdown(pulses) {
  const counts = {
    text: 0,
    voice_tone: 0,
    face: 0,
  }
  let fallbackToTextCount = 0

  for (const pulse of pulses) {
    const source = `${pulse.emotionSource ?? ''}`
    if (source === 'face') {
      counts.face += 1
      continue
    }

    if (source === 'voice_tone') {
      counts.voice_tone += 1
      continue
    }

    counts.text += 1
    if (source === 'text_fallback') {
      fallbackToTextCount += 1
    }
  }

  const totalCount = pulses.length
  const items = [
    { source: 'text', label: '文本线索', count: counts.text },
    { source: 'voice_tone', label: '语气线索', count: counts.voice_tone },
    { source: 'face', label: '表情线索', count: counts.face },
  ].map((item) => ({
    ...item,
    ratio: totalCount > 0 ? Number((item.count / totalCount).toFixed(2)) : 0,
  }))

  return {
    totalCount,
    fallbackToTextCount,
    items,
    note: buildSourceBreakdownNote(items, fallbackToTextCount),
  }
}

function buildSourceBreakdownNote(items, fallbackToTextCount) {
  const topSource = [...items].sort((a, b) => b.count - a.count)[0]
  if (!topSource || topSource.count === 0) {
    return '最近 7 天还没有足够的情绪线索，建议继续通过日常联系积累观察。'
  }

  const fallbackNote =
    fallbackToTextCount > 0
      ? `其中 ${fallbackToTextCount} 次语气分析降级按文本内容理解。`
      : ''

  return `最近 7 天的判断主要来自${topSource.label}。${fallbackNote}`.trim()
}

function buildStableSummary(pulses, abnormalPulses) {
  if (pulses.length === 0) {
    return '最近 7 天还没有新的情绪线索，建议继续保持轻量联系。'
  }

  if (abnormalPulses.length === 0) {
    return '最近 7 天整体较平稳，今天更适合保持日常陪伴，而不是只盯着单次异常。'
  }

  return `最近 7 天共整理出 ${abnormalPulses.length} 条需要优先关注的变化，建议先处理异常，再看整体趋势。`
}

function pickDominantLabel(pulses) {
  if (pulses.length === 0) return 'steady'
  const scores = new Map()
  for (const pulse of pulses) {
    const label = pulse.emotionLabel ?? 'neutral'
    const nextScore = (scores.get(label) ?? 0) + severityWeight(pulse.severity)
    scores.set(label, nextScore)
  }

  return [...scores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'steady'
}

function pickHighestSeverity(pulses) {
  if (pulses.some((pulse) => pulse.severity === 'HIGH')) return 'HIGH'
  if (pulses.some((pulse) => pulse.severity === 'MEDIUM')) return 'MEDIUM'
  return 'LOW'
}

function severityWeight(severity) {
  if (severity === 'HIGH') return 3
  if (severity === 'MEDIUM') return 2
  return 1
}

function toSeverityLabel(severity) {
  if (severity === 'HIGH') return '优先关注'
  if (severity === 'MEDIUM') return '建议关注'
  return '日常留意'
}

function normalizeSource(source) {
  if (source === 'face') return 'face'
  if (source === 'voice_tone') return 'voice_tone'
  return 'text'
}

function toSourceLabel(source) {
  if (source === 'face') return '表情线索'
  if (source === 'voice_tone') return '语气线索'
  return '文本线索'
}

function toEmotionLabelText(label) {
  if (label === 'positive') return '积极'
  if (label === 'neutral') return '平稳'
  if (label === 'negative') return '低落'
  if (label === 'anxious') return '紧张'
  if (label === 'sad') return '低落'
  if (label === 'angry') return '烦躁'
  if (label === 'calm') return '平静'
  return '平稳'
}

function toDayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatMonthDay(date) {
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
}
