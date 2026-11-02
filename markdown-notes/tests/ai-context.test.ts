import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareAiContext, estimateTokens, type HistoryMessage } from '../src/shared/ai-context';
test('上下文：短笔记原样、最近对话保留，预算估算区分中文与ASCII', () => {
  const history: HistoryMessage[] = [
    { role: 'user', content: '解释这篇笔记' },
    { role: 'assistant', content: '主要概念' },
  ];
  const p = prepareAiContext(history, '# 当前笔记\n\n原始正文', '继续解释', '标题', 4096);
  assert(p.note_complete);
  assert.equal(p.content, '# 当前笔记\n\n原始正文');
  assert.deepEqual(p.history, history);
  assert(p.estimated_input_tokens <= 4096);
  assert.equal(estimateTokens('abcdef'), 2);
  assert.equal(estimateTokens('中文'), 3);
});
test('上下文：长对话压缩早期摘录与操作状态，保留近期请求且不重复已应用的全文', () => {
  const history: HistoryMessage[] = Array.from({ length: 40 }, (_, i) => ({
    role: i % 2 ? 'assistant' : 'user',
    content: (i === 1 ? '操作状态：已应用\n' : '') + '第' + i + '条对话，' + '历史内容'.repeat(80),
  }));
  history[0].content = '长期要求：不得删除代码示例，保持中文。';
  history[39].content = '最近的回答：操作状态：已应用';
  const p = prepareAiContext(history, '笔记最新正文', '继续精简', '标题', 4096);
  assert(p.omitted_history > 0);
  assert(p.history.some((m) => m.content.includes('不得删除代码示例')));
  assert(p.history.length <= 13);
  assert(p.history.some((m) => m.content.includes('近期摘录')));
  assert(p.history.at(-1)!.content.includes('最近的回答'));
  assert(p.history.at(-1)!.content.includes('已应用'));
  assert(p.estimated_input_tokens <= 4096);
});
test('上下文：大笔记按问题取相关片段、显式标记不完整；长要求不静默截断', () => {
  const chunks = Array.from(
    { length: 50 },
    (_, i) =>
      '## 章节' +
      i +
      '\n' +
      (i === 37 ? '谱分解：特征值和特征向量。' : '') +
      '背景材料'.repeat(1200),
  );
  const p = prepareAiContext([], chunks.join('\n\n'), '解释谱分解', '课程', 4096);
  assert(!p.note_complete);
  assert(p.content.includes('笔记节选'));
  assert(p.content.includes('谱分解'));
  assert(p.estimated_input_tokens <= 4096);
  assert(p.content.isWellFormed());
  assert.throws(() => prepareAiContext([], '正文', '要求'.repeat(3000), '标题', 4096));
});
