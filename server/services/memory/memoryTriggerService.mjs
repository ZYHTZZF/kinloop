import { listMemories, createMemoryEntry } from '../../repositories/memoryRepository.mjs';

/**
 * 分析消息文本并触发相关回忆
 * @param {string} messageText 消息内容
 * @param {string} userId 用户ID (可选)
 * @param {string} familyId 家庭ID (可选)
 * @returns {Object} { triggered: boolean, memory: Object | null }
 */
export async function analyzeAndTriggerMemory(messageText, userId, familyId) {
  if (!messageText || typeof messageText !== 'string') {
    return { triggered: false };
  }

  // --- 1. “自动沉淀”逻辑 ---
  // 当你发的话里包含了明显值得记录的事物，系统自动将其作为一个新记忆保存！
  // 满足您的要求：“我发一句老地方是肯德基，后面也要能回忆提示到我自己发的话”
  const autoSaveKeywords = ['老地方', '肯德基', '以前', '记得', '小时候', '最喜欢', '爱吃', '讨厌', '老家', '秘密基地'];
  if (autoSaveKeywords.some(kw => messageText.includes(kw)) && messageText.length >= 3) {
    const currentMemories = listMemories();
    const alreadySaved = currentMemories.some(mem => mem.description === messageText);
    if (!alreadySaved) {
      const kw = autoSaveKeywords.find(k => messageText.includes(k));
      createMemoryEntry({
        familySpaceId: familyId || 'fs_demo',
        sourceConvId: null,
        sourceMsgId: null,
        addedByMemberId: userId || 'member_user',
        memoryType: 'Text',
        title: `${kw || '回忆'}`,
        description: messageText,
        status: 'ACTIVE',
        visibleScope: 'FamilySpaceDefault'
      });
    }
  }

  // 2. 获取所有的记忆（包含了刚才自动保存的新记忆）
  const allMemories = listMemories();
  if (allMemories.length === 0) {
    return { triggered: false };
  }

  // 3. 查询相关记忆，大幅扩展提示词库
  let targetMemory = null;
  let matchedKeyword = '';

  const possibleKeywords = [
    '花', '院子', '橙子', '周末', '老地方', '吃饭', '中秋', 
    '肯德基', '麦当劳', '照片', '老家', '小时候', '以前', '记得', 
    '喜欢', '旅游', '老张', '王阿姨', '红烧肉', '散步', '秘密基地'
  ];
  const wordsInMessage = possibleKeywords.filter(w => messageText.includes(w));

  for (const mem of allMemories) {
    // 避开“自己触发自己”（如果这条回忆就是刚由这句话生成的，则在这句话下方不触发提示）
    if (mem.description === messageText) continue;

    const memText = (mem.title || '') + ' ' + (mem.description || '');
    
    // 规则A：通过扩充的关键词库交叉匹配
    for (const w of wordsInMessage) {
      if (memText.includes(w)) {
        targetMemory = mem;
        matchedKeyword = w;
        break;
      }
    }
    
    // 规则B：动态匹配！如果某条记忆的标题或描述中的核心特指词直接被提到，也可以立刻触发
    if (!targetMemory && mem.title && mem.title.length >= 2 && messageText.includes(mem.title)) {
        targetMemory = mem;
        matchedKeyword = mem.title;
    }

    if (targetMemory) break;
  }

  // 根据真实的匹配决定是否提示
  if (targetMemory) {
    return {
      triggered: true,
      memory: {
        id: targetMemory.id,
        title: targetMemory.title || '往事回忆',
        summary: targetMemory.description || '一段美好的回忆',
        date: targetMemory.addedAt ? new Date(targetMemory.addedAt).toLocaleDateString() : '最近',
        keyword: matchedKeyword
      }
    };
  }

  return { triggered: false };
}

