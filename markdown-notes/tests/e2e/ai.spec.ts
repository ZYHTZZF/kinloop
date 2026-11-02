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
    if (mode === 'hold') return;
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
      ZHIYE_DATA_DIR: root,
    };
    delete env.ELECTRON_RUN_AS_NODE;
    const app = await electron.launch({ args: ['.'], cwd: process.cwd(), env }),
      page = await app.firstWindow();
    await expect(page.getByRole('button', { name: '新建笔记', exact: true })).toBeEnabled();
    return { app, page };
  };
  return {
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
    await page.getByRole('button', { name: '关闭对话框' }).click();
    await page.getByRole('button', { name: 'AI助手', exact: true }).click();
    await expect(page.getByRole('log', { name: 'AI聊天记录' })).toContainText(
      '生成一篇课程复习笔记',
    );
    await page.getByRole('button', { name: '关闭对话框' }).click();
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
    await page.getByRole('button', { name: '关闭对话框' }).click();
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
    await page.getByRole('button', { name: '关闭对话框' }).click();
    expect(await page.evaluate(async () => (await window.notesApi.call('note.list')).total)).toBe(
      1,
    );
  } finally {
    await app.close();
    await f.close();
  }
});
