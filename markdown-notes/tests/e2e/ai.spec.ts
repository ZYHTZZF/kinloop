import { test, expect, _electron as electron } from '@playwright/test';
import { createServer, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readBackup } from '../../src/backend/archive';
async function fixture() {
  const requests: { path: string; body: any; authorization?: string }[] = [];
  let mode = 'ok';
  const held: ServerResponse[] = [];
  const result =
    '## 模拟AI结果\n\n- 关键知识点\n\n[[当前课程]]\n\n<script>window.__aiUnsafe=true</script>';
  const server = createServer(async (req, res: ServerResponse) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    requests.push({
      path: req.url!,
      body: raw ? JSON.parse(raw) : null,
      authorization: req.headers.authorization,
    });
    if (mode === 'hold') {
      held.push(res);
      return;
    }
    if (mode === 'redirect') {
      res.writeHead(302, { Location: '/must-not-follow' });
      res.end();
      return;
    }
    if (mode === 'error') {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: req.headers.authorization } }));
      return;
    }
    let request: any = {};
    try {
      request = JSON.parse(raw);
    } catch {}
    let prompt = '';
    try {
      prompt = JSON.parse(request.messages?.at(-1)?.content).本次用户要求 ?? '';
    } catch {}
    const tool = /润色/.test(prompt)
      ? {
          name: 'propose_note_edit',
          arguments: JSON.stringify({
            content: '# 润色后的课程\n\n更清晰的知识点',
            summary: '建议润色正文，保留原意。',
          }),
        }
      : /生成|新建/.test(prompt)
        ? {
            name: 'create_note',
            arguments: JSON.stringify({
              title: 'AI课程笔记',
              content: '# 生成的新笔记\n\n课程复习提纲',
              summary: '建议创建一篇课程复习笔记。',
            }),
          }
        : null;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        choices: [
          {
            message: tool
              ? { content: null, tool_calls: [{ id: 'call_1', type: 'function', function: tool }] }
              : { content: result },
            finish_reason: tool ? 'tool_calls' : 'stop',
          },
        ],
        usage: { total_tokens: 35 },
      }),
    );
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}/v1`;
  const root = mkdtempSync(join(tmpdir(), 'zhiye-ai-ui-')),
    key = 'fake-test-key-' + randomUUID();
  const launch = async () => {
    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      MARKITDOWN_DATA_DIR: root,
    };
    delete env.ELECTRON_RUN_AS_NODE;
    const app = await electron.launch({ args: ['.'], cwd: process.cwd(), env }),
      page = await app.firstWindow();
    await expect(page.getByRole('button', { name: '新建笔记', exact: true })).toBeEnabled();
    return { app, page };
  };
  return {
    release: () => {
      for (const res of held.splice(0))
        if (!res.destroyed) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              choices: [{ message: { content: '延迟完成的回复' }, finish_reason: 'stop' }],
            }),
          );
        }
    },
    root,
    key,
    base,
    result,
    requests,
    launch,
    setMode: (next: string) => {
      mode = next;
    },
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((r) => server.close(() => r()));
    },
  };
}
test('聊天Agent：密钥加密、对话总结、编辑预览应用、新建工具、多轮历史和备份排除密钥', async () => {
  const f = await fixture();
  let { app, page } = await f.launch();
  try {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1080, 700));
    await page.getByRole('button', { name: 'AI助手', exact: true }).click();
    await page.getByRole('button', { name: 'AI设置', exact: true }).click();
    await page.getByRole('textbox', { name: 'AI API地址', exact: true }).fill(f.base);
    await page.getByRole('textbox', { name: 'AI模型名称', exact: true }).fill('mock-model');
    await page.getByRole('textbox', { name: 'AI API Key', exact: true }).fill(f.key);
    await page.getByRole('button', { name: '保存AI配置' }).click();
    await expect(page.getByText('AI配置已保存，密钥不会随笔记备份导出')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'AI API Key', exact: true })).toHaveValue('');
    const settings = await page.evaluate(() => window.notesApi.call('ai.get'));
    expect(settings.has_key).toBe(true);
    expect(JSON.stringify(settings)).not.toContain(f.key);
    expect(readFileSync(join(f.root, '.host/ai/connection.json'), 'utf8')).not.toContain(f.key);
    await page.getByRole('button', { name: '测试AI连接' }).click();
    await expect(page.getByText('连接成功，服务已返回有效文本')).toBeVisible();
    expect(f.requests[0].body.messages).toHaveLength(1);
    await page.getByRole('button', { name: '关闭对话框' }).click();
    await page.evaluate(async () => {
      await window.notesApi.call('note.create', {
        title: '另一篇笔记',
        content: 'OTHER_PRIVATE_NOTE_MUST_NOT_LEAK',
      });
      await window.notesApi.call('note.create', { title: '当前课程', content: '原始课程正文' });
    });
    await page.locator('.note-card').filter({ hasText: '当前课程' }).click();
    const editor = page.getByRole('textbox', { name: 'Markdown编辑器' });
    await editor.fill('当前最新草稿，尚未点击保存。');
    await page.getByRole('button', { name: 'AI总结当前笔记' }).click();
    await page.getByRole('button', { name: '发送', exact: true }).click();
    await expect(page.getByRole('article', { name: 'AI回复' })).toContainText('关键知识点');
    const sent = JSON.stringify(f.requests[1].body);
    expect(sent).toContain('当前最新草稿');
    expect(sent).not.toContain('OTHER_PRIVATE_NOTE_MUST_NOT_LEAK');
    expect(sent).not.toContain(f.key);
    expect(f.requests[1].authorization).toBe('Bearer ' + f.key);
    expect(await page.evaluate(() => (window as any).__aiUnsafe)).toBeUndefined();
    await page.getByRole('button', { name: '追加到笔记', exact: true }).click();
    await expect(editor).toHaveValue('当前最新草稿，尚未点击保存。\n\n' + f.result);
    const input = page.getByRole('textbox', { name: '发给AI的消息' });
    await input.fill('帮我润色这篇笔记');
    await page.getByRole('button', { name: '发送', exact: true }).click();
    await expect(page.getByRole('button', { name: '应用修改', exact: true })).toBeVisible();
    await expect(editor).not.toHaveValue('# 润色后的课程\n\n更清晰的知识点');
    expect(f.requests[2].body.messages.length).toBeGreaterThan(2);
    expect(f.requests[2].body.tools.some((t: any) => t.function.name === 'propose_note_edit')).toBe(
      true,
    );
    await page.getByRole('button', { name: '应用修改', exact: true }).click();
    await expect(editor).toHaveValue('# 润色后的课程\n\n更清晰的知识点');
    await page.getByRole('checkbox', { name: '附带当前笔记', exact: true }).uncheck();
    await input.fill('生成一篇课程复习笔记');
    await input.press('Enter');
    await expect(page.getByRole('button', { name: '创建这篇笔记', exact: true })).toBeVisible();
    const last = JSON.parse(f.requests[3].body.messages.at(-1).content);
    expect(last.当前笔记.正文).toBe('');
    expect(JSON.stringify(f.requests[3].body.messages)).toContain('已应用');
    await page.getByRole('textbox', { name: 'AI新笔记标题' }).fill('AI生成的课程笔记');
    await page.screenshot({ animations: 'disabled', path: 'test-results/知页-AI聊天Agent.png' });
    await page.getByRole('button', { name: '创建这篇笔记', exact: true }).click();
    await expect(page.locator('.document-heading h1')).toHaveText('AI生成的课程笔记');
    await expect(editor).toHaveValue('# 生成的新笔记\n\n课程复习提纲');
    await page.getByRole('button', { name: '收起AI聊天面板' }).click();
    await page.getByRole('button', { name: 'AI助手', exact: true }).click();
    await expect(page.getByRole('log', { name: 'AI聊天记录' })).toContainText(
      '生成一篇课程复习笔记',
    );
    await page.getByRole('button', { name: '收起AI聊天面板' }).click();
    await app.evaluate(
      ({ dialog }, directory) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [directory] });
      },
      join(f.root, 'backup'),
    );
    const record = await page.evaluate(() => window.notesApi.call('backup.create'));
    const snapshot = (await readBackup(record.file_path)).snapshot;
    expect(JSON.stringify(snapshot)).not.toContain(f.key);
    expect(JSON.stringify(snapshot)).not.toContain(f.base);
    await app.close();
    ({ app, page } = await f.launch());
    expect((await page.evaluate(() => window.notesApi.call('ai.get'))).has_key).toBe(true);
    await page.getByRole('button', { name: '备份与恢复', exact: true }).click();
    await page.getByRole('button', { name: 'AI设置', exact: true }).click();
    await page.getByRole('button', { name: '清除配置与密钥' }).click();
    await expect(page.getByText('AI配置与保存的密钥已清除')).toBeVisible();
  } finally {
    await app.close();
    await f.close();
  }
});
test('聊天错误、取消、重定向与超限不改原文，建议可放弃并继续对话', async () => {
  const f = await fixture(),
    { app, page } = await f.launch();
  try {
    await page.evaluate(
      async ({ base, key }) => {
        await window.notesApi.call('ai.set', { base_url: base, model: 'mock-model', api_key: key });
        await window.notesApi.call('note.create', {
          title: '保护原文',
          content: '原文不能被AI失败覆盖',
        });
      },
      { base: f.base, key: f.key },
    );
    await page.locator('.note-card').filter({ hasText: '保护原文' }).click();
    await page.getByRole('button', { name: 'AI总结当前笔记' }).click();
    const input = page.getByRole('textbox', { name: '发给AI的消息' }),
      send = page.getByRole('button', { name: '发送', exact: true });
    f.setMode('error');
    await send.click();
    await expect(page.getByRole('alert')).toContainText('API Key无效');
    expect(await page.locator('body').textContent()).not.toContain(f.key);
    f.setMode('hold');
    await send.click();
    await page.getByRole('button', { name: '停止生成' }).click();
    await expect(page.getByRole('alert')).toContainText('已取消');
    f.setMode('redirect');
    await send.click();
    await expect(page.getByRole('alert')).toContainText('重定向');
    expect(f.requests.some((r) => r.path === '/must-not-follow')).toBe(false);
    f.setMode('ok');
    await input.fill('润色这篇笔记');
    await send.click();
    await expect(page.getByRole('button', { name: '应用修改' })).toBeVisible();
    await page.getByRole('button', { name: '放弃建议' }).click();
    await expect(page.getByRole('button', { name: '应用修改' })).toHaveCount(0);
    await page.getByRole('button', { name: '收起AI聊天面板' }).click();
    await expect(page.getByRole('textbox', { name: 'Markdown编辑器' })).toHaveValue(
      '原文不能被AI失败覆盖',
    );
    const before = f.requests.length;
    await page.getByRole('textbox', { name: 'Markdown编辑器' }).fill('中'.repeat(45000));
    await page.getByRole('button', { name: 'AI总结当前笔记' }).click();
    await send.click();
    await expect(page.locator('.ai-context-budget')).toContainText('笔记已节选');
    await expect.poll(() => f.requests.length).toBe(before + 1);
    expect(
      f.requests.at(-1)!.body.tools.some((t: any) => t.function.name === 'propose_note_edit'),
    ).toBe(false);
    await page.getByRole('button', { name: '收起AI聊天面板' }).click();
    expect(await page.evaluate(async () => (await window.notesApi.call('note.list')).total)).toBe(
      1,
    );
  } finally {
    await app.close();
    await f.close();
  }
});
test('右侧持续聊天：并行编辑、跨笔记、收起保留草稿和在途请求，附件选择／移除与小窗口', async () => {
  const f = await fixture(),
    { app, page } = await f.launch();
  try {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1480, 940));
    await page.evaluate(
      async ({ base, key }) => {
        await window.notesApi.call('ai.set', { base_url: base, model: 'mock-model', api_key: key });
        await window.notesApi.call('note.create', { title: '聊天笔记B', content: 'B的资料' });
        await window.notesApi.call('note.create', { title: '聊天笔记A', content: 'A的资料' });
      },
      { base: f.base, key: f.key },
    );
    await page.locator('.note-card').filter({ hasText: '聊天笔记A' }).click();
    await page.getByRole('button', { name: 'AI助手', exact: true }).click();
    const panel = page.getByRole('complementary', { name: 'AI聊天面板' });
    const input = page.getByRole('textbox', { name: '发给AI的消息' });
    const editor = page.getByRole('textbox', { name: 'Markdown编辑器' });
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await input.fill('持续聊天的草稿');
    await page.getByRole('button', { name: '收起AI聊天面板' }).click();
    await expect(panel).toBeHidden();
    await expect(page.getByRole('button', { name: 'AI助手', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'AI助手', exact: true }).click();
    await expect(input).toHaveValue('持续聊天的草稿');
    f.setMode('hold');
    await page.getByRole('button', { name: '发送', exact: true }).click();
    await expect.poll(() => f.requests.length).toBe(1);
    await page.getByRole('button', { name: '收起AI聊天面板' }).click();
    await editor.fill('在AI运行期间编辑，保留新草稿');
    await page.locator('.note-card').filter({ hasText: '聊天笔记B' }).click();
    f.setMode('ok');
    f.release();
    await page.getByRole('button', { name: 'AI助手', exact: true }).click();
    await expect(page.getByRole('log')).toContainText('延迟完成的回复');
    await expect(page.locator('.ai-chat-context')).toContainText('聊天笔记B');
    await input.fill('继续解释');
    await input.press('Enter');
    await expect(page.getByRole('log')).toContainText('关键知识点');
    expect(JSON.stringify(f.requests[1].body.messages)).toContain('持续聊天的草稿');
    expect(JSON.parse(f.requests[1].body.messages.at(-1).content).当前笔记.标题).toBe('聊天笔记B');
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
      'base64',
    );
    const pdf = readFileSync(join(process.cwd(), 'reports/成品中文与公式验证.pdf'));
    const before = f.requests.length;
    await page.locator('input[aria-label="选择聊天附件"]').setInputFiles([
      { name: '图片.png', mimeType: 'image/png', buffer: png },
      { name: '课程.pdf', mimeType: 'application/pdf', buffer: pdf },
      { name: '材料.md', mimeType: 'text/markdown', buffer: Buffer.from('附件中的课程资料') },
    ]);
    await expect(page.locator('.ai-attachment')).toHaveCount(3);
    expect(f.requests.length).toBe(before);
    await page.getByRole('checkbox', { name: 'PDF原文件', exact: true }).check();
    await input.fill('分析附件');
    await input.press('Enter');
    await expect.poll(() => f.requests.length).toBe(before + 1);
    await expect(input).toBeEnabled();
    const parts = f.requests.at(-1)!.body.messages.at(-1).content;
    expect(parts.map((p: any) => p.type)).toEqual(['text', 'image_url', 'file']);
    expect(parts[0].text).toContain('附件中的课程资料');
    await page.getByRole('checkbox', { name: 'PDF原文件', exact: true }).uncheck();
    await input.fill('使用PDF文字继续聊');
    await input.press('Enter');
    await expect.poll(() => f.requests.length).toBe(before + 2);
    await expect(input).toBeEnabled();
    const extracted = f.requests.at(-1)!.body.messages.at(-1).content;
    expect(extracted.map((p: any) => p.type)).toEqual(['text', 'image_url']);
    expect(extracted[0].text).toContain('中文学习笔记');
    expect(extracted[0].text).toContain('不含图片');
    await input.fill('附件相关的后续草稿');
    await page.getByRole('button', { name: 'AI助手', exact: true }).click();
    await page.getByRole('button', { name: 'AI助手', exact: true }).click();
    await expect(input).toHaveValue('附件相关的后续草稿');
    await expect(page.locator('.ai-attachment')).toHaveCount(3);
    for (const width of [1480, 1080]) {
      await app.evaluate(
        ({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setSize(width, 700),
        width,
      );
      await page.evaluate(() => window.dispatchEvent(new Event('resize')));
      await expect
        .poll(() =>
          page.evaluate(() => {
            const panel = document.querySelector('#ai-panel')!.getBoundingClientRect();
            const doc = document.querySelector('.document')!.getBoundingClientRect();
            const toolbar = document.querySelector('.editor-toolbar')!;
            return (
              panel.left >= doc.right &&
              doc.width >= 419 &&
              panel.right <= innerWidth &&
              toolbar.scrollWidth <= toolbar.clientWidth + 2
            );
          }),
        )
        .toBe(true);
      await expect(editor).toBeEditable();
      await expect(page.getByRole('button', { name: '发送', exact: true })).toBeInViewport();
      expect(
        await page.evaluate(() => {
          const composer = document.querySelector('.ai-chat-composer')!.getBoundingClientRect();
          const send = document.querySelector('.ai-chat-send')!.getBoundingClientRect();
          const messages = document.querySelector('.ai-chat-messages')!.getBoundingClientRect();
          return send.bottom <= composer.bottom + 1 && messages.height >= 59;
        }),
      ).toBe(true);
      await page.screenshot({
        animations: 'disabled',
        path: `test-results/Mark-It-Down-AI侧栏-${width}.png`,
      });
    }
    await page.getByRole('button', { name: '移除附件：图片.png' }).click();
    await page.getByRole('button', { name: '移除附件：课程.pdf' }).click();
    await page.getByRole('button', { name: '移除附件：材料.md' }).click();
    await input.fill('移除附件后继续聊');
    await input.press('Enter');
    await expect.poll(() => f.requests.length).toBe(before + 3);
    expect(typeof f.requests.at(-1)!.body.messages.at(-1).content).toBe('string');
    await expect(input).toBeEnabled();
    await page.getByRole('button', { name: '新对话', exact: true }).click();
    await expect(page.getByRole('log')).not.toContainText('持续聊天的草稿');
    await expect(input).toHaveValue('');
    await page.getByRole('button', { name: '收起AI聊天面板' }).click();
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('.note-list')).toBeVisible();
  } finally {
    await app.close();
    await f.close();
  }
});
