import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/backend/store';
import { decodeText, importedTitle, chatAttachments, type AiAttachment } from '../src/shared/files';
import { validateAttachments } from '../src/attachments';
import { prepareChatContext } from '../src/shared/ai-context';
import { LIMITS } from '../src/shared/rules';
import { AiService } from '../src/ai-service';

test('Markdown文字编码：UTF8/BOM/UTF16、中英文与CRLF；错误编码和二进制拒绝', () => {
  const value = '# 中文\r\n\r\n公式 $x^2$';
  assert.equal(decodeText(Buffer.from(value)), value);
  assert.equal(decodeText(Buffer.from('\ufeff' + value)), value);
  assert.equal(
    decodeText(Buffer.concat([Buffer.from([255, 254]), Buffer.from(value, 'utf16le')])),
    value,
  );
  assert.throws(() => decodeText(Buffer.from([255, 255])));
  assert.throws(() => decodeText(Buffer.from('binary\0text')));
  assert.equal(importedTitle('[课程].MD'), '课程');
});
test('批量导入：同名编号、不覆盖、一次事务、幂等、提交失败和引用超限整体回滚', () => {
  const s = new Store(join(mkdtempSync(join(tmpdir(), 'mark-import-')), 'data.sqlite'), true);
  try {
    const original = s.mutate('note.create', { title: '课程', content: '原文' }, randomUUID());
    const p = {
        files: [
          { title: '课程', filename: '课程.md', content: '导入内容 [[第二篇]]' },
          { title: '第二篇', filename: '第二篇.md', content: '[[课程]]' },
        ],
      },
      id = randomUUID();
    const result = s.mutate('note.import', p, id);
    assert.deepEqual(
      result.imported.map((n: any) => n.title),
      ['课程 (1)', '第二篇'],
    );
    assert.equal(s.note(original.note_id).content, '原文');
    assert.deepEqual(s.mutate('note.import', p, id), result);
    const before = s.snapshot();
    assert.throws(() =>
      s.mutate(
        'note.import',
        { files: [p.files[0], { ...p.files[1], content: '中'.repeat(400000) }] },
        randomUUID(),
      ),
    );
    assert.deepEqual(s.snapshot(), before);
    assert.throws(() => s.mutate('note.import', p, randomUUID(), 'beforeCommit'));
    assert.deepEqual(s.snapshot(), before);
    const limit = LIMITS.links;
    try {
      LIMITS.links = 2;
      assert.throws(
        () =>
          s.mutate(
            'note.import',
            { files: [{ title: '超限', filename: '超限.md', content: '[[课程]] [[第二篇]]' }] },
            randomUUID(),
          ),
        /容量/,
      );
    } finally {
      LIMITS.links = limit;
    }
    assert.deepEqual(s.snapshot(), before);
  } finally {
    s.close();
  }
});
const attachment = (
  kind: 'image' | 'pdf' | 'text',
  data: string,
  mime: AiAttachment['mime'],
  size: number,
): AiAttachment => ({
  id: randomUUID(),
  name: kind === 'pdf' ? '资料.pdf' : kind === 'image' ? '图片.png' : '资料.md',
  kind,
  mime,
  size,
  data,
});
const pngBytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
  'base64',
);
const png = () =>
  attachment(
    'image',
    'data:image/png;base64,' + pngBytes.toString('base64'),
    'image/png',
    pngBytes.length,
  );
test('附件校验：仅内联数据，长度、签名、类型、重复与总容量校验', () => {
  assert.equal(validateAttachments([png()]).length, 1);
  assert.throws(() => validateAttachments([{ ...png(), data: 'https://example.com/image.png' }]));
  assert.throws(() => validateAttachments([{ ...png(), size: 1 }]));
  const f = png();
  assert.throws(() => validateAttachments([f, f]));
  assert.throws(() => validateAttachments([{ ...png(), mime: 'application/pdf' }]));
});
test('附件上下文：文字显式节选、二进制预留、低预算拒绝而不悄悄丢附件', () => {
  const text = attachment('text', '知识'.repeat(6000), 'text/plain', 36000);
  const p = prepareChatContext([], '完整笔记', '总结', '课程', 16384, [text, png()]);
  assert(p.attachment_text.includes('节选'));
  assert(p.note_complete);
  assert(p.estimated_input_tokens <= 16384);
  assert.equal(p.binary_reserve, 2048);
  assert.throws(() => prepareChatContext([], '', '总结', '', 4096, [png()]), /附件/);
});
test('PDF默认提取文字兼容普通模型；无文字PDF提示原文件模式，原文件不伪装为文字', () => {
  const raw = attachment('pdf', 'data:application/pdf;base64,JVBERi0=', 'application/pdf', 5);
  assert.throws(() => chatAttachments([raw], false), /未提取到文字/);
  assert.equal(chatAttachments([raw], true)[0].kind, 'pdf');
  const text = chatAttachments(
    [{ ...raw, extracted_text: 'PDF文字', extracted_excerpt: true }],
    false,
  )[0];
  assert.equal(text.kind, 'text');
  assert(text.data.includes('节选'));
  assert(text.data.includes('不含图片'));
});
test('真实请求结构：图片image_url、PDF file与文字节选，工具和原文保护保留', async () => {
  let sent: any;
  const s = new AiService(
    mkdtempSync(join(tmpdir(), 'mark-multimodal-')),
    { available: async () => false, encrypt: async () => Buffer.alloc(0), decrypt: async () => '' },
    async (_url, init) => {
      sent = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({ choices: [{ message: { content: '附件总结' }, finish_reason: 'stop' }] }),
      );
    },
  );
  await s.save({ base_url: 'http://127.0.0.1:1234/v1', model: 'fixture' });
  const pdf = Buffer.from('%PDF-1.4\nfixture');
  await s.run({
    request_id: randomUUID(),
    action: 'chat',
    instructions: '看图和PDF',
    content: '原文',
    can_edit: true,
    attachments: [
      png(),
      attachment(
        'pdf',
        'data:application/pdf;base64,' + pdf.toString('base64'),
        'application/pdf',
        pdf.length,
      ),
      attachment('text', '资料文字', 'text/plain', 12),
    ],
  });
  assert.deepEqual(
    sent.messages.at(-1).content.map((p: any) => p.type),
    ['text', 'image_url', 'file'],
  );
  assert(sent.messages.at(-1).content[0].text.includes('资料文字'));
  assert(sent.tools.some((t: any) => t.function.name === 'propose_note_edit'));
  assert(!JSON.stringify(sent).includes('file:///'));
});
