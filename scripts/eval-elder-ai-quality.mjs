import fs from 'node:fs'
import path from 'node:path'

const API = process.env.KINLOOP_EVAL_API ?? 'http://127.0.0.1:8787'

const members = [
  { id: 'member_son', role: 'Family', displayName: '儿子', elderAlias: '儿子' },
  { id: 'member_daughter', role: 'Primary', displayName: '女儿', elderAlias: '女儿' },
]

const conversations = [
  { id: 'conv_son', memberId: 'member_son', name: '儿子', elderDisplayName: '李阿姨' },
  { id: 'conv_daughter', memberId: 'member_daughter', name: '女儿', elderDisplayName: '李阿姨' },
]

const cases = [
  // Chat / operation
  { id: 'send_daughter_dinner', category: 'chat_action', text: '帮我给女儿发条消息。你今晚回来吃饭吗？', action: 'open_conversation', target: 'member_daughter', autoSend: true },
  { id: 'send_son_backhome', category: 'chat_action', text: '给儿子发送你今天回来吃饭吗', action: 'open_conversation', target: 'member_son', autoSend: true },
  { id: 'tell_daughter_later', category: 'chat_action', text: '请替我跟闺女讲一声，今晚别太晚回家', action: 'open_conversation', target: 'member_daughter', autoSend: true },
  { id: 'open_chat_daughter', category: 'chat_action', text: '打开和女儿聊天', action: 'open_conversation', target: 'member_daughter', autoSend: false },
  { id: 'ask_son_take_medicine', category: 'chat_action', text: '帮我问问儿子今天吃药没有', action: 'open_conversation', target: 'member_son', autoSend: true },

  // Emergency / support
  { id: 'emergency_chest', category: 'emergency', text: '我胸口很痛，快联系家人', action: 'trigger_alert' },
  { id: 'emergency_fall', category: 'emergency', text: '我摔倒了，快来帮我', action: 'trigger_alert' },
  { id: 'support_unwell', category: 'support', text: '我有点难受，帮帮我', action: 'trigger_alert' },

  // Memory
  { id: 'memory_open', category: 'memory', text: '我想看看之前的照片', action: 'open_memories' },
  { id: 'memory_save', category: 'memory', text: '把这件事帮我记下来', action: 'save_memory' },

  // QA / companion
  { id: 'qa_qingming', category: 'qa', text: '清明节一般是什么时候', action: 'stay', replyKeywords: ['4月', '公历'] },
  { id: 'qa_duanwu', category: 'qa', text: '端午节一般是几月', action: 'stay', replyKeywords: ['月', '农历'] },
  { id: 'qa_food', category: 'qa', text: '晚上吃什么比较清淡', action: 'stay', minReplyLen: 8 },
  { id: 'qa_sleep', category: 'qa', text: '晚上睡不着怎么办', action: 'stay', minReplyLen: 8 },
  { id: 'companion_chat', category: 'companion', text: '陪我聊聊天', action: 'stay', minReplyLen: 6 },
  { id: 'companion_lonely', category: 'companion', text: '我有点想家，你陪我说说话', action: 'stay', minReplyLen: 6 },

  // Clarify / noisy
  { id: 'clarify_noise', category: 'clarify', text: '嗯啊那个这个', action: 'clarify' },
  { id: 'clarify_short', category: 'clarify', text: '这个那个', action: 'clarify' },
]

const stabilityCases = [
  'send_daughter_dinner',
  'tell_daughter_later',
  'emergency_chest',
  'qa_qingming',
  'companion_chat',
  'clarify_noise',
]

function percentile(nums, p) {
  if (!nums.length) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[idx]
}

function includesAny(text, keywords) {
  return keywords.some((k) => text.includes(k))
}

function evaluate(caseDef, result) {
  const errors = []
  if (result.nextAction !== caseDef.action) {
    errors.push(`action ${result.nextAction} != ${caseDef.action}`)
  }
  if (caseDef.target && result.targetMemberId !== caseDef.target) {
    errors.push(`target ${result.targetMemberId ?? 'null'} != ${caseDef.target}`)
  }
  if (typeof caseDef.autoSend === 'boolean' && result.nextAction === 'open_conversation') {
    if (Boolean(result.autoSendMessage) !== caseDef.autoSend) {
      errors.push(`autoSend ${Boolean(result.autoSendMessage)} != ${caseDef.autoSend}`)
    }
  }
  if (caseDef.minReplyLen) {
    const r = String(result.assistantReply ?? '')
    if (r.trim().length < caseDef.minReplyLen) {
      errors.push(`assistantReply too short (${r.trim().length})`)
    }
  }
  if (caseDef.replyKeywords) {
    const r = String(result.assistantReply ?? '')
    if (!includesAny(r, caseDef.replyKeywords)) {
      errors.push(`assistantReply missing keywords: ${caseDef.replyKeywords.join(',')}`)
    }
  }
  return { pass: errors.length === 0, errors }
}

async function infer(text) {
  const body = {
    spokenText: text,
    members,
    conversations,
  }
  const start = Date.now()
  const response = await fetch(`${API}/api/ai/elder-intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  })
  const elapsedMs = Date.now() - start
  if (!response.ok) {
    const payload = await response.text()
    throw new Error(`HTTP ${response.status}: ${payload}`)
  }
  const payload = await response.json()
  return { elapsedMs, result: payload.result }
}

async function main() {
  const health = await fetch(`${API}/api/health`)
  if (!health.ok) {
    throw new Error(`Health check failed: ${health.status}`)
  }

  const rows = []

  for (const c of cases) {
    const { elapsedMs, result } = await infer(c.text)
    const judged = evaluate(c, result)
    rows.push({
      phase: 'main',
      caseId: c.id,
      category: c.category,
      text: c.text,
      expectedAction: c.action,
      expectedTarget: c.target ?? null,
      action: result.nextAction,
      target: result.targetMemberId ?? null,
      autoSend: Boolean(result.autoSendMessage),
      confidence: Number(result.confidence ?? 0),
      assistantReply: String(result.assistantReply ?? ''),
      elapsedMs,
      pass: judged.pass,
      errors: judged.errors,
    })
    console.log(`[main] ${c.id}\taction=${result.nextAction}\ttarget=${result.targetMemberId ?? '-'}\tauto=${Boolean(result.autoSendMessage)}\tconf=${result.confidence}\tms=${elapsedMs}\tpass=${judged.pass}`)
  }

  for (let r = 1; r <= 2; r += 1) {
    for (const id of stabilityCases) {
      const c = cases.find((x) => x.id === id)
      if (!c) continue
      const { elapsedMs, result } = await infer(c.text)
      const judged = evaluate(c, result)
      rows.push({
        phase: `stability_r${r}`,
        caseId: c.id,
        category: c.category,
        text: c.text,
        expectedAction: c.action,
        expectedTarget: c.target ?? null,
        action: result.nextAction,
        target: result.targetMemberId ?? null,
        autoSend: Boolean(result.autoSendMessage),
        confidence: Number(result.confidence ?? 0),
        assistantReply: String(result.assistantReply ?? ''),
        elapsedMs,
        pass: judged.pass,
        errors: judged.errors,
      })
      console.log(`[stability r${r}] ${c.id}\taction=${result.nextAction}\ttarget=${result.targetMemberId ?? '-'}\tauto=${Boolean(result.autoSendMessage)}\tconf=${result.confidence}\tms=${elapsedMs}\tpass=${judged.pass}`)
    }
  }

  const pass = rows.filter((x) => x.pass).length
  const total = rows.length
  const latencies = rows.map((x) => x.elapsedMs)
  const summary = {
    api: API,
    totals: {
      pass,
      total,
      rate: Number(((pass / total) * 100).toFixed(2)),
      avgMs: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
      p50Ms: percentile(latencies, 50),
      p95Ms: percentile(latencies, 95),
    },
    byCategory: {},
  }

  for (const category of [...new Set(rows.map((x) => x.category))]) {
    const g = rows.filter((x) => x.category === category)
    const gp = g.filter((x) => x.pass).length
    summary.byCategory[category] = {
      pass: gp,
      total: g.length,
      rate: Number(((gp / g.length) * 100).toFixed(2)),
      avgMs: Math.round(g.map((x) => x.elapsedMs).reduce((a, b) => a + b, 0) / g.length),
    }
  }

  const outDir = path.resolve(process.cwd(), 'reports')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.resolve(outDir, 'elder-ai-eval.json')
  fs.writeFileSync(outPath, JSON.stringify({ summary, rows }, null, 2), 'utf8')

  console.log('SUMMARY')
  console.log(JSON.stringify(summary, null, 2))
  console.log(`REPORT_FILE\t${outPath}`)

  const failures = rows.filter((x) => !x.pass)
  if (failures.length) {
    console.log('FAILURES')
    for (const f of failures) {
      console.log(`${f.phase}\t${f.caseId}\t${f.errors.join('; ')}`)
    }
  }
}

main().catch((err) => {
  console.error('[eval] failed:', err)
  process.exitCode = 1
})

