import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { LLM_API_KEY, LLM_BASE_URL, LLM_MODEL, UPLOADS_DIR } from '../config.mjs'

const REQUEST_TIMEOUT_MS = 60000

const TEXT = {
  missingInput: 'messageText or imageUrl is required',
  failed: 'Generation bridge explanation failed',
  fallbackExplain: '\u6682\u65f6\u6ca1\u80fd\u7a33\u5b9a\u89e3\u6790\u8fd9\u6761\u5185\u5bb9\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5\u3002',
  fallbackSuggest: '\u4f60\u53ef\u4ee5\u5148\u8fd9\u6837\u56de\uff1a\u6211\u60f3\u66f4\u597d\u5730\u7406\u89e3\u4f60\uff0c\u4f60\u80fd\u518d\u8bf4\u5f97\u8be6\u7ec6\u4e00\u70b9\u5417\uff1f',
  fallbackMeme: '',
}

const SLANG_BRIDGE_RULES = [
  {
    keywords: ['emo', 'emo了', '好emo', '有点emo', '很emo'],
    explanation: '对方是在说自己这会儿情绪低落、心里闷闷的，带一点伤感和丧气。',
    followUpSuggestion: '你是不是最近有点难受？如果你愿意，可以跟我多说一点。',
    memeExplanation: '“emo”是网络上常说的情绪低落、突然很伤感的意思。',
  },
  {
    keywords: ['破防', '破防了'],
    explanation: '对方是说自己被这句话戳到了，情绪上有点绷不住了。',
    followUpSuggestion: '是不是我这句话让你有点难受了？你可以直接告诉我你的感受。',
    memeExplanation: '“破防”原本像是心理防线被打破，现在常用来表示被触动、被刺痛了。',
  },
  {
    keywords: ['上头', '太上头了'],
    explanation: '对方是在说这件事让自己情绪很投入，越想越停不下来。',
    followUpSuggestion: '听起来这件事对你影响挺大，你愿意再跟我说说吗？',
    memeExplanation: '“上头”就是一下子特别投入，情绪或注意力被带起来了。',
  },
  {
    keywords: ['yyds'],
    explanation: '对方是在夸你或者夸这件事特别好，意思接近“太厉害了”或“最好”。',
    followUpSuggestion: '你这么说我还挺开心的，谢谢你。',
    memeExplanation: '“yyds”是“永远的神”的缩写，表示特别认可、特别佩服。',
  },
  {
    keywords: ['绝绝子'],
    explanation: '对方是在说这件事特别好、特别绝，语气里带着夸赞。',
    followUpSuggestion: '你这么夸我，我都有点不好意思了。',
    memeExplanation: '“绝绝子”是网络上的夸奖说法，意思接近“太棒了”“真绝了”。',
  },
]

export function registerGenerationBridgeRoutes(app) {
  app.post('/api/ai/generation-bridge/explain', async (req, res) => {
    try {
      const messageText = normalizeText(req.body?.messageText)
      const imageUrl = normalizeText(req.body?.imageUrl)
      const requesterRole = normalizeRole(req.body?.requesterRole)
      const requesterName = normalizeText(req.body?.requesterName)
      const peerName = normalizeText(req.body?.peerName)

      if (!messageText && !imageUrl) {
        res.status(400).json({ error: TEXT.missingInput })
        return
      }

      if (!LLM_API_KEY || !LLM_MODEL) {
        res.json(buildFallbackPayload(messageText))
        return
      }

      try {
        const result = await explainWithLlm({ messageText, imageUrl, requesterRole, requesterName, peerName })
        res.json(result)
      } catch (error) {
        console.warn('[GenerationBridge] LLM failed, fallback:', error)
        res.json(buildFallbackPayload(messageText))
      }
    } catch (error) {
      console.error('[GenerationBridge] request failed:', error)
      res.status(500).json({ error: TEXT.failed })
    }
  })
}

async function explainWithLlm({ messageText, imageUrl, requesterRole, requesterName, peerName }) {
  const relationPrompt = buildRelationPrompt({ requesterRole, requesterName, peerName })
  const systemPrompt = [
    '\u4f60\u662f\u201c\u4ee3\u9645\u6c9f\u901a\u7ffb\u8bd1\u52a9\u624b\u201d\u3002',
    '\u76ee\u6807\u6709\u4e09\u4e2a\uff1a',
    '1) \u7528\u7b80\u5355\u81ea\u7136\u7684\u4e2d\u6587\u89e3\u91ca\u201c\u5bf9\u65b9\u8fd9\u53e5\u8bdd/\u8fd9\u5f20\u56fe\u60f3\u8868\u8fbe\u4ec0\u4e48\u201d\u3002',
    '2) \u7ed9\u4e00\u53e5\u53ef\u76f4\u63a5\u53d1\u9001\u7684\u5efa\u8bae\u56de\u590d\uff08\u9700\u8981\u6709\u5171\u60c5\uff0c\u4e0d\u751f\u786c\uff09\u3002',
    '3) \u4e3b\u52a8\u5224\u65ad\u91cc\u9762\u6709\u6ca1\u6709\u6897\u3001\u7f51\u7edc\u70ed\u8bcd\u3001\u9ed1\u8bdd\u3001\u53cc\u5173\u6216\u9690\u542b\u5178\u6545\u3002',
    '\u786c\u6027\u8981\u6c42\uff1a',
    '- \u4e0d\u8981\u8f93\u51fa\u201c\u8fd9\u53e5\u8bdd\u7684\u610f\u601d\u662f\uff1a\u201d\u6216\u201c\u4f60\u53ef\u4ee5\u56de\u590d\uff1a\u201d\u8fd9\u7c7b\u524d\u7f00',
    '- \u4e0d\u8981\u7f16\u9020\u80cc\u666f\uff0c\u4e0d\u8981\u4e71\u731c\u8eab\u4efd',
    '- \u5efa\u8bae\u56de\u590d\u8981\u5177\u4f53\uff0c\u4e0d\u8981\u7a7a\u6cdb\u8ffd\u95ee',
    '- \u5982\u679c\u6ca1\u6709\u68c0\u51fa\u660e\u786e\u7684\u6897\u6216\u70ed\u8bcd\uff0chasMeme \u5fc5\u987b\u4e3a false\uff0cmemeExplanation \u8fd4\u56de null',
    '- \u5982\u679c\u6709\u68c0\u51fa\uff0c\u8bf7\u7528\u5927\u767d\u8bdd\u89e3\u91ca\u8fd9\u4e2a\u6897\u5728\u8bf4\u4ec0\u4e48\uff0c\u4e0d\u8981\u5356\u5f04',
    '- \u82e5\u5185\u5bb9\u786e\u5b9e\u4e0d\u6e05\u6670\uff0c\u660e\u786e\u8bf4\u4e0d\u786e\u5b9a\uff0c\u518d\u7ed9\u4e00\u53e5\u6e29\u548c\u6c42\u8865\u5145\u7684\u56de\u590d',
    relationPrompt,
    '\u4e25\u683c JSON \u8f93\u51fa\uff1a{"explanation":"...","followUpSuggestion":"...","hasMeme":true,"memeExplanation":"..."}',
  ].join('\n')

  const userParts = []
  if (requesterName || peerName) {
    userParts.push(`当前对话双方：发送者约为“${peerName || '对方'}”，接收者约为“${requesterName || '当前用户'}”`)
  }
  if (messageText) {
    userParts.push(`\u6587\u672c\u5185\u5bb9\uff1a${messageText}`)
  }
  if (imageUrl) {
    userParts.push('\u56fe\u7247\u5185\u5bb9\u89e3\u6790\uff1a\u8bf7\u7ed3\u5408\u56fe\u7247\u7406\u89e3\u6897\u610f\u3001\u8bed\u6c14\u548c\u60c5\u7eea\u3002')
  }
  const userText = userParts.join('\n')

  const preparedImageUrl = await prepareImageUrlForModel(imageUrl)

  const userMessage = preparedImageUrl
    ? {
        role: 'user',
        content: [
          { type: 'text', text: userText },
          { type: 'image_url', image_url: { url: preparedImageUrl } },
        ],
      }
    : { role: 'user', content: userText }

  const payload = {
    model: LLM_MODEL,
    temperature: 0.2,
    max_tokens: 300,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      userMessage,
    ],
  }

  let response = await fetchWithTimeout(
    `${LLM_BASE_URL}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify(payload),
    },
    REQUEST_TIMEOUT_MS,
  )

  if (!response.ok && response.status === 400) {
    const text = await safeText(response)
    // Retry without response_format for providers that don't support json_object.
    const retryPayload = { ...payload, response_format: undefined }
    if (/response_format|json_object/i.test(text)) {
      response = await fetchWithTimeout(
        `${LLM_BASE_URL}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${LLM_API_KEY}`,
          },
          body: JSON.stringify(retryPayload),
        },
        REQUEST_TIMEOUT_MS,
      )
    } else if (/image|vision|multimodal/i.test(text)) {
      throw new Error(`Current model does not support image input: ${text}`)
    } else {
      throw new Error(`LLM HTTP 400: ${text}`)
    }
  }

  if (!response.ok) {
    throw new Error(`LLM HTTP ${response.status}: ${await safeText(response)}`)
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content
  const parsed = tryParseJson(typeof content === 'string' ? content : '{}')

  const explanation = normalizeText(parsed.explanation)
  const followUpSuggestion = normalizeText(parsed.followUpSuggestion)
  const memeExplanation = normalizeText(parsed.memeExplanation)
  const hasMeme = Boolean(parsed.hasMeme && memeExplanation)

  return {
    explanation: explanation || TEXT.fallbackExplain,
    followUpSuggestion: followUpSuggestion || TEXT.fallbackSuggest,
    hasMeme,
    memeExplanation: hasMeme ? memeExplanation : null,
    glossary: [],
    mode: 'llm',
  }
}

async function prepareImageUrlForModel(imageUrl) {
  const raw = normalizeText(imageUrl)
  if (!raw) return ''
  if (raw.startsWith('data:')) return raw

  if (raw.startsWith('/uploads/')) {
    const relative = raw.slice('/uploads/'.length).replace(/\\/g, '/')
    const safeRoot = resolve(UPLOADS_DIR)
    const absolute = resolve(safeRoot, relative)
    if (!absolute.startsWith(safeRoot + sep) && absolute !== safeRoot) {
      return raw
    }
    try {
      const bin = await readFile(absolute)
      const mime = guessMimeFromPath(absolute)
      return `data:${mime};base64,${bin.toString('base64')}`
    } catch {
      return raw
    }
  }

  if (/^https?:\/\//i.test(raw)) {
    try {
      return await downloadUrlAsDataUrl(raw)
    } catch {
      return raw
    }
  }

  return raw
}

async function downloadUrlAsDataUrl(url) {
  const res = await fetchWithTimeout(
    url,
    { method: 'GET' },
    12000,
  )
  if (!res.ok) {
    throw new Error(`Download image failed: ${res.status}`)
  }
  const contentType = res.headers.get('content-type') || guessMimeFromPath(url)
  const arr = await res.arrayBuffer()
  const base64 = Buffer.from(arr).toString('base64')
  return `data:${contentType};base64,${base64}`
}

function guessMimeFromPath(path) {
  const ext = extname(path).toLowerCase()
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.bmp') return 'image/bmp'
  return 'image/png'
}

function buildFallbackPayload(messageText = '') {
  const ruleBased = explainByRules(messageText)
  if (ruleBased) {
    return {
      ...ruleBased,
      mode: 'fallback',
    }
  }

  return {
    explanation: TEXT.fallbackExplain,
    followUpSuggestion: TEXT.fallbackSuggest,
    hasMeme: false,
    memeExplanation: TEXT.fallbackMeme || null,
    glossary: [],
    mode: 'fallback',
  }
}

function explainByRules(messageText) {
  const normalized = normalizeRuleText(messageText)
  if (!normalized) return null

  const matchedRule = SLANG_BRIDGE_RULES.find((rule) =>
    rule.keywords.some((keyword) => normalized.includes(normalizeRuleText(keyword))),
  )

  if (!matchedRule) return null

  return {
    explanation: matchedRule.explanation,
    followUpSuggestion: matchedRule.followUpSuggestion,
    hasMeme: Boolean(matchedRule.memeExplanation),
    memeExplanation: matchedRule.memeExplanation || null,
    glossary: [],
  }
}

function normalizeText(value) {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function normalizeRuleText(value) {
  if (typeof value !== 'string') return ''
  return value.trim().toLowerCase()
}

function normalizeRole(value) {
  return value === 'elder' || value === 'family' ? value : 'elder'
}

function buildRelationPrompt({ requesterRole, requesterName, peerName }) {
  if (requesterRole === 'elder') {
    return [
      '生成“建议回复”时，请把接收者当作长辈，把发送者当作家人。',
      `如果对方名字像“${peerName || '女儿/儿子/家人'}”，回复要像长辈对晚辈说话，语气自然、亲近、不过度年轻化。`,
      `避免使用太潮、太互联网化、太书面化的表达。默认口吻像${requesterName || '长辈'}在和自家孩子说话。`,
    ].join('')
  }

  return [
    '生成“建议回复”时，请把接收者当作子女/晚辈，把发送者当作长辈。',
    `回复要像${requesterName || '家人'}在对${peerName || '长辈'}说话，语气体贴、稳当、尊重，带一点亲人间的自然关心。`,
    '避免太油腻、太官方、太命令式，也避免年轻人之间的玩梗口吻。',
  ].join('')
}

function tryParseJson(content) {
  try {
    return JSON.parse(content)
  } catch {
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) return {}
    return JSON.parse(match[0])
  }
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function safeText(response) {
  try {
    return await response.text()
  } catch {
    return ''
  }
}
