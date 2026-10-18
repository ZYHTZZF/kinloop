import express from 'express';
import { analyzeAndTriggerMemory } from '../services/memory/memoryTriggerService.mjs';

const router = express.Router();

/**
 * POST /api/memories/trigger
 * { messageId, text, userId, familyId }
 */
router.post('/trigger', async (req, res) => {
  try {
    const { messageId, text, userId, familyId } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required for memory trigger analysis' });
    }

    const result = await analyzeAndTriggerMemory(text, userId, familyId);
    
    // 返回 { triggered: true/false, memory: { id, title, summary, date, keyword } }
    res.json(result);
  } catch (error) {
    console.error('Error in POST /api/memories/trigger:', error);
    res.status(500).json({ error: 'Internal server error while analyzing memory triggers' });
  }
});

export default router;
