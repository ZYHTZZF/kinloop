import { listMemories, createMemoryEntry } from '../../repositories/memoryRepository.mjs'

export async function analyzeAndTriggerMemory(messageText, userId, familyId) {
  if (!messageText || typeof messageText !== 'string') {
    return { triggered: false }
  }

  const resolvedFamilyId = familyId || 'fs_demo'
  const autoSaveKeywords = ['老地方', '肯德基', '以前', '记得', '小时候', '最喜欢', '爱吃', '老家', '秘密基地']

  if (autoSaveKeywords.some((keyword) => messageText.includes(keyword)) && messageText.length >= 3) {
    const currentMemories = listMemories(resolvedFamilyId)
    const alreadySaved = currentMemories.some((memory) => memory.description === messageText)
    if (!alreadySaved) {
      const matchedKeyword = autoSaveKeywords.find((keyword) => messageText.includes(keyword))
      createMemoryEntry({
        sourceConvId: null,
        sourceMsgId: null,
        addedByMemberId: userId || 'member_user',
        memoryType: 'Text',
        title: `${matchedKeyword || '回忆'}`,
        description: messageText,
        status: 'ACTIVE',
        visibleScope: 'FamilySpaceDefault',
      }, resolvedFamilyId)
    }
  }

  const allMemories = listMemories(resolvedFamilyId)
  if (allMemories.length === 0) {
    return { triggered: false }
  }

  let targetMemory = null
  let matchedKeyword = ''
  const possibleKeywords = ['花', '院子', '橙子', '周末', '老地方', '吃饭', '中秋', '肯德基', '照片', '老家', '小时候', '以前', '记得']
  const wordsInMessage = possibleKeywords.filter((keyword) => messageText.includes(keyword))

  for (const memory of allMemories) {
    if (memory.description === messageText) continue

    const memoryText = `${memory.title || ''} ${memory.description || ''}`
    for (const keyword of wordsInMessage) {
      if (memoryText.includes(keyword)) {
        targetMemory = memory
        matchedKeyword = keyword
        break
      }
    }

    if (!targetMemory && memory.title && memory.title.length >= 2 && messageText.includes(memory.title)) {
      targetMemory = memory
      matchedKeyword = memory.title
    }

    if (targetMemory) break
  }

  if (!targetMemory) {
    return { triggered: false }
  }

  return {
    triggered: true,
    memory: {
      id: targetMemory.id,
      title: targetMemory.title || '往事回忆',
      summary: targetMemory.description || '一段美好的回忆',
      date: targetMemory.addedAt ? new Date(targetMemory.addedAt).toLocaleDateString('zh-CN') : '最近',
      keyword: matchedKeyword,
    },
  }
}
