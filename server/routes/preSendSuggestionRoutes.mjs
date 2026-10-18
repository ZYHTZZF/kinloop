import {
  canUseSuggestionLlm,
  classifySuggestionScenario,
  generateSuggestionWithLlm,
} from '../services/preSendSuggestion/suggestionEngine.mjs'

export function registerPreSendSuggestionRoutes(app) {
  app.post('/api/ai/pre-send-suggestions', async (req, res) => {
    try {
      const conversationId = String(req.body?.conversationId ?? '').trim()
      const draft = String(req.body?.draft ?? '').trim()
      const messages = Array.isArray(req.body?.messages) ? req.body.messages.slice(-5) : []

      if (!conversationId) {
        res.status(400).json({ error: 'conversationId is required' })
        return
      }

      if (!draft) {
        res.status(400).json({ error: 'draft is required' })
        return
      }

      const classification = classifySuggestionScenario({ draft, messages })
      if (!classification) {
        res.json({ ok: true, result: null, source: 'fallback' })
        return
      }

      if (!canUseSuggestionLlm()) {
        res.json({ ok: true, result: null, source: 'fallback' })
        return
      }

      try {
        const result = await generateSuggestionWithLlm({ draft, messages, classification })
        res.json({ ok: true, result, source: result ? 'llm' : 'fallback' })
      } catch (error) {
        console.warn('[PreSendSuggestion] LLM failed, fallback:', error)
        res.json({ ok: true, result: null, source: 'fallback' })
      }
    } catch (error) {
      console.error('[PreSendSuggestion] request failed:', error)
      res.status(500).json({ error: 'pre-send suggestion failed' })
    }
  })
}
