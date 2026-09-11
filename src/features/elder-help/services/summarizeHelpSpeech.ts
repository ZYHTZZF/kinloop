import type { HelpRequestRecord, SupportChannel } from '../types'

type SummarizedHelpRequest = Pick<
  HelpRequestRecord,
  'title' | 'summary' | 'originalText' | 'channel' | 'responseGoal'
>

type ResponsesApiResponse = {
  output?: Array<{
    content?: Array<{
      text?: string
      type?: string
    }>
  }>
}

const USE_REAL_AI = true
const AI_API_URL = 'https://ark.cn-beijing.volces.com/api/v3/responses'
const AI_API_KEY = 'REDACTED_CONFIGURE_IN_ENV'
const AI_MODEL = 'doubao-seed-2-0-pro-260215'

function normalizeSpeech(text: string) {
  return text
    .replace(/[，。！？、；：]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function clampSummary(text: string, maxLength: number) {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength).trim()}...`
}

function mockSummarize(text: string): SummarizedHelpRequest {
  const normalized = normalizeSpeech(text)
  const wantsFamily = /女儿|儿子|家人|家里人|老伴|孩子/.test(normalized)
  const needsMedicine = /药|药盒|吃药|服药/.test(normalized)
  const needsEmergency = /不舒服|头晕|胸闷|喘|摔|疼|难受|站不稳/.test(normalized)
  const needsCompany = /陪|慌|害怕|一个人|说说话/.test(normalized)

  let channel: SupportChannel = 'service'
  let title = '需要帮助'
  let summary = clampSummary(normalized, 26) || '老人发来一条求助，请尽快查看。'
  let responseGoal = '尽快确认谁来回应'

  if (needsEmergency) {
    channel = 'emergency'
    title = '身体不适，需要尽快关注'
    summary = '老人表示身体不适，需要尽快有人确认情况。'
    responseGoal = '5 分钟内确认是否需要紧急处理'
  } else if (needsMedicine) {
    channel = 'service'
    title = '用药相关求助'
    summary = '老人提到药物或服药问题，需要尽快协助确认。'
    responseGoal = '30 分钟内确认药物情况'
  } else if (wantsFamily) {
    channel = 'family'
    title = '想联系家人'
    summary = '老人希望尽快联系家人。'
    responseGoal = '尽快联系到家属'
  } else if (needsCompany) {
    channel = 'family'
    title = '需要有人陪一会儿'
    summary = '老人需要有人回应和陪伴。'
    responseGoal = '尽快建立通话或回电'
  }

  return {
    title,
    summary,
    originalText: normalized,
    channel,
    responseGoal,
  }
}

function extractJsonBlock(content: string) {
  const trimmed = content.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed
  }

  const match = trimmed.match(/\{[\s\S]*\}/)
  return match?.[0] ?? ''
}

function readOutputText(data: ResponsesApiResponse) {
  return (
    data.output
      ?.flatMap((item) => item.content ?? [])
      .map((item) => item.text ?? '')
      .join('\n')
      .trim() ?? ''
  )
}

async function summarizeWithRealAI(text: string): Promise<SummarizedHelpRequest> {
  const normalized = normalizeSpeech(text)

  const response = await fetch(AI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text:
                '你是银发用户求助场景的整理助手。请把老人较长、重复、口语化的话，整理成发给子女的一句清晰摘要。' +
                '请严格输出 JSON，不要输出额外解释。字段：title、summary、channel、responseGoal。' +
                'channel 只能是 family、neighbor、service、emergency 之一。summary 要简短、具体、自然。',
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `老人原话：${normalized}`,
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`AI request failed: ${response.status} ${errorText}`)
  }

  const data = (await response.json()) as ResponsesApiResponse
  const content = readOutputText(data)
  const jsonText = extractJsonBlock(content)

  if (!jsonText) {
    throw new Error(`AI response did not contain JSON: ${content}`)
  }

  const parsed = JSON.parse(jsonText) as Partial<SummarizedHelpRequest>

  return {
    title: parsed.title?.trim() || '需要帮助',
    summary: parsed.summary?.trim() || clampSummary(normalized, 26) || '老人发来一条求助，请尽快查看。',
    originalText: normalized,
    channel:
      parsed.channel === 'family' ||
      parsed.channel === 'neighbor' ||
      parsed.channel === 'service' ||
      parsed.channel === 'emergency'
        ? parsed.channel
        : 'service',
    responseGoal: parsed.responseGoal?.trim() || '尽快确认谁来回应',
  }
}

export async function summarizeHelpSpeech(text: string): Promise<SummarizedHelpRequest> {
  const normalized = normalizeSpeech(text)

  if (!normalized) {
    return {
      title: '需要帮助',
      summary: '老人发来一条求助，请尽快查看。',
      originalText: '',
      channel: 'service',
      responseGoal: '尽快确认谁来回应',
    }
  }

  if (!USE_REAL_AI || !AI_API_KEY.trim()) {
    return mockSummarize(normalized)
  }

  try {
    return await summarizeWithRealAI(normalized)
  } catch (error) {
    console.error('summarizeHelpSpeech failed:', error)
    return mockSummarize(normalized)
  }
}
