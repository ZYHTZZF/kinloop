const LABEL_TEXT = {
  calm: '平静',
  positive: '积极',
  sad: '低落',
  anxious: '紧张',
  neutral: '平稳',
}

function normalizeSamples(samples) {
  if (!Array.isArray(samples)) {
    return []
  }

  return samples
    .filter((sample) => sample && typeof sample === 'object')
    .map((sample) => ({
      timestamp: Number(sample.timestamp ?? 0),
      label: normalizeLabel(sample.label),
      score: normalizeUnit(sample.score),
      confidence: normalizeUnit(sample.confidence),
    }))
    .filter((sample) => Boolean(sample.label))
}

function normalizeLabel(value) {
  return ['calm', 'positive', 'sad', 'anxious', 'neutral'].includes(value) ? value : null
}

function normalizeUnit(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return 0
  }

  return Math.max(0, Math.min(1, numeric))
}

function countLabels(samples) {
  const counts = new Map()
  for (const sample of samples) {
    counts.set(sample.label, (counts.get(sample.label) ?? 0) + 1)
  }
  return counts
}

function pickDominantLabel(samples) {
  if (samples.length === 0) {
    return null
  }

  const counts = countLabels(samples)
  return [...counts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1]
      }

      const rightAverage = averageScore(samples, right[0])
      const leftAverage = averageScore(samples, left[0])
      return rightAverage - leftAverage
    })[0]?.[0] ?? null
}

function averageScore(samples, label) {
  const filtered = samples.filter((sample) => sample.label === label)
  if (filtered.length === 0) {
    return 0
  }

  return filtered.reduce((sum, sample) => sum + sample.score, 0) / filtered.length
}

function toMinutesLabel(durationMs) {
  const totalSeconds = Math.max(0, Math.round(Number(durationMs ?? 0) / 1000))
  if (totalSeconds < 60) {
    return `${totalSeconds} 秒`
  }

  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (seconds === 0) {
    return `${minutes} 分钟`
  }

  return `${minutes} 分 ${seconds} 秒`
}

function buildFaceSummary(faceSamples, dominantLabel) {
  const counts = countLabels(faceSamples)
  const dominantCount = dominantLabel ? counts.get(dominantLabel) ?? 0 : 0

  if (!dominantLabel) {
    return '本次视频通话已结束，未获取到足够的情绪采样数据。'
  }

  if (dominantLabel === 'positive') {
    return `本次视频通话约 ${dominantCount > 1 ? '大多数时段' : '部分时段'} 表情较积极，整体互动状态不错。`
  }

  if (dominantLabel === 'calm' || dominantLabel === 'neutral') {
    const hasSad = (counts.get('sad') ?? 0) > 0
    const hasAnxious = (counts.get('anxious') ?? 0) > 0

    if (hasSad) {
      return '本次视频通话整体表情较平静，期间出现少量低落迹象。'
    }

    if (hasAnxious) {
      return '本次视频通话整体情绪较平稳，后半段有些紧张表现。'
    }

    return '本次视频通话中，老人多数时段表情平稳，整体状态较平静。'
  }

  if (dominantLabel === 'sad') {
    return '本次视频通话中，老人表情偏低落，能看到一些无力和失落感。'
  }

  if (dominantLabel === 'anxious') {
    return '本次视频通话中，老人表情偏紧张，出现了一些不安和局促迹象。'
  }

  return '本次视频通话已结束，整体情绪状态较平稳。'
}

function buildVoiceSummary(voiceSamples) {
  const dominantLabel = pickDominantLabel(voiceSamples)
  if (!dominantLabel) {
    return ''
  }

  if (dominantLabel === 'calm' || dominantLabel === 'neutral') {
    return '语气整体比较平稳。'
  }

  if (dominantLabel === 'positive') {
    return '语气里能感觉到一些轻松和积极。'
  }

  if (dominantLabel === 'sad') {
    return '语气里带有些低落。'
  }

  if (dominantLabel === 'anxious') {
    return '语气里带有些紧张。'
  }

  return ''
}

export function isVideoCallEmotionSummaryRequestValid(payload) {
  return Boolean(
    payload
    && typeof payload === 'object'
    && payload.conversationId
    && payload.familySpaceId
    && payload.callType === 'video'
    && payload.targetRole === 'elder',
  )
}

export function buildVideoCallEmotionSummary(payload) {
  const faceSamples = normalizeSamples(payload.faceSamples)
  const voiceSamples = normalizeSamples(payload.voiceSamples)
  const sampleCount = faceSamples.length + voiceSamples.length
  const dominantLabel = pickDominantLabel(faceSamples) ?? pickDominantLabel(voiceSamples)

  if (sampleCount === 0) {
    return {
      summary: '视频通话情绪总结：本次视频通话已结束，未获取到足够的情绪采样数据。',
      dominantLabel: null,
      sampleCount,
    }
  }

  const durationText = toMinutesLabel(payload.durationMs)
  const faceSummary = buildFaceSummary(faceSamples, dominantLabel)
  const voiceSummary = buildVoiceSummary(voiceSamples)
  const joined = voiceSummary ? `${faceSummary}${voiceSummary}` : faceSummary

  return {
    summary: `视频通话情绪总结：${joined.replace('本次视频通话', `本次视频通话约 ${durationText}`)}`,
    dominantLabel,
    sampleCount,
  }
}

export function toVideoCallEmotionLabelText(label) {
  return label ? LABEL_TEXT[label] ?? '平稳' : '平稳'
}
