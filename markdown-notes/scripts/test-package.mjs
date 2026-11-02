import { _electron } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, createReadStream, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createServer } from 'node:http';
import { randomUUID, createHash } from 'node:crypto';
import { packageDirectory } from './package-directory.mjs';
const exe = join(packageDirectory(), '知页.exe'),
  root = mkdtempSync(join(tmpdir(), 'zhiye-packaged-'));
const env = { ...process.env, ZHIYE_DATA_DIR: root };
delete env.ELECTRON_RUN_AS_NODE;
const mockKey = 'packaged-fake-' + randomUUID();
const mockAI = createServer(async (req, res) => {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const edit = JSON.parse(raw).messages.at(-1).content.includes('润色');
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: 'call_package',
                type: 'function',
                function: {
                  name: edit ? 'propose_note_edit' : 'create_note',
                  arguments: JSON.stringify(
                    edit
                      ? { content: '## 成品AI润色正文\n\n内容更清晰。', summary: '建议润色正文' }
                      : {
                          title: '成品AI新笔记',
                          content: '## 成品AI模拟总结\n\n- 关键知识点',
                          summary: '建议创建笔记，等待确认',
                        },
                  ),
                },
              },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
    }),
  );
});
await new Promise((resolve) => mockAI.listen(0, '127.0.0.1', resolve));
const mockUrl = `http://127.0.0.1:${mockAI.address().port}/v1`;
const app = await _electron.launch({ executablePath: exe, args: [], env });
try {
  const page = await app.firstWindow();
  await page.getByRole('button', { name: '新建笔记', exact: true }).click();
  await page.getByRole('button', { name: '创建空白笔记', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Markdown编辑器' })
    .fill(
      '# Windows成品验证\n\n中文学习笔记：离线公式与导出。\n\n行内 $E=mc^2$\n\n$$\\frac{1}{2}+\\sqrt{x}+\\text{中文说明}$$',
    );
  await page.waitForFunction(() =>
    document.querySelector('.save-status')?.textContent?.includes('已保存'),
  );
  assert.equal(await page.locator('.markdown h1').textContent(), 'Windows成品验证');
  assert.equal(await page.locator('.markdown .katex').count(), 2);
  await page.getByRole('button', { name: '备份与恢复', exact: true }).click();
  await page.getByRole('button', { name: '外观', exact: true }).click();
  await page.getByRole('button', { name: '选择主色#7352c7', exact: true }).click();
  await page.getByLabel('背景颜色', { exact: true }).fill('#e7e3ef');
  await page.getByRole('button', { name: '应用外观', exact: true }).click();
  await page.waitForFunction(
    () =>
      getComputedStyle(document.documentElement).getPropertyValue('--accent-fill').trim() ===
      '#7352c7',
  );
  await page.getByRole('button', { name: '关闭对话框', exact: true }).click();
  await page.evaluate(() => document.fonts.ready.then(() => true));
  const pdf = resolve('reports/成品中文与公式验证.pdf');
  await app.evaluate(({ dialog }, path) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: path });
  }, pdf);
  await page.getByRole('button', { name: '导出PDF', exact: true }).click();
  await page.getByRole('checkbox', { name: '带背景导出', exact: true }).check();
  await page.getByRole('button', { name: '导出PDF文件', exact: true }).click();
  await page.waitForFunction(() =>
    document.querySelector('[role="status"]')?.textContent?.includes('PDF已导出'),
  );
  assert.equal(readFileSync(pdf).subarray(0, 5).toString(), '%PDF-');
  await page.getByRole('button', { name: '即时', exact: true }).click();
  const live = page.getByRole('textbox', { name: '即时编辑器', exact: true });
  await live.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('## ');
  await page.keyboard.insertText('成品即时编辑');
  assert.equal(await page.getByRole('heading', { level: 2, name: '成品即时编辑' }).count(), 1);
  await page.keyboard.press('Control+s');
  await page.waitForFunction(() =>
    document.querySelector('.save-status')?.textContent?.includes('已保存'),
  );
  await page.getByRole('button', { name: '查看目录大纲' }).click();
  await page
    .getByRole('complementary', { name: '目录大纲' })
    .getByRole('button', { name: /H2.*成品即时编辑/ })
    .click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '收藏笔记', exact: true }).last().click();
  await page.getByRole('button', { name: '置顶笔记', exact: true }).click();
  await page.getByRole('button', { name: '保存为模板', exact: true }).click();
  await page.getByRole('textbox', { name: '模板名称' }).fill('成品验证模板');
  await page.getByRole('button', { name: '保存模板', exact: true }).click();
  await page.getByRole('button', { name: '新建笔记', exact: true }).click();
  await page.getByRole('button', { name: '使用模板：成品验证模板', exact: true }).click();
  await page.getByRole('button', { name: '分屏', exact: true }).click();
  const source = page.getByRole('textbox', { name: 'Markdown编辑器' });
  await source.fill('[[成品验证模');
  await page.getByRole('option', { name: '成品验证模板', exact: true }).click();
  assert.equal(await source.inputValue(), '[[成品验证模板]]');
  await page.keyboard.press('Control+s');
  await page.waitForFunction(() =>
    document.querySelector('.save-status')?.textContent?.includes('已保存'),
  );
  await page.getByRole('button', { name: '收藏笔记', exact: true }).first().click();
  await page.waitForFunction(
    () =>
      document.querySelector('.list-heading h1')?.textContent === '收藏笔记' &&
      document.querySelectorAll('.note-card').length === 1,
  );
  assert.equal(await page.locator('.note-card').count(), 1);
  await page.locator('.note-card').click();
  await page.getByRole('button', { name: '取消置顶' }).waitFor();
  await app.evaluate(
    ({ dialog }, path) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] });
    },
    join(root, 'backups'),
  );
  const backupRecord = await page.evaluate(() => window.notesApi.call('backup.create'));
  assert.equal(backupRecord.format_version, 2);
  assert(readFileSync(backupRecord.file_path).length > 0);
  await page.evaluate(
    async ({ url, key }) =>
      window.notesApi.call('ai.set', { base_url: url, model: 'packaged-mock', api_key: key }),
    { url: mockUrl, key: mockKey },
  );
  await page.getByRole('button', { name: 'AI总结当前笔记' }).click();
  await page.getByRole('textbox', { name: '发给AI的消息' }).fill('生成一篇成品AI笔记');
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await page
    .getByRole('article', { name: 'AI建议正文' })
    .getByRole('heading', { name: '成品AI模拟总结' })
    .waitFor();
  await page.getByRole('button', { name: '创建这篇笔记' }).click();
  await page.waitForFunction(
    () => document.querySelector('.document-heading h1')?.textContent === '成品AI新笔记',
  );
  await page.getByRole('textbox', { name: '发给AI的消息' }).fill('润色这篇笔记');
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await page.getByRole('button', { name: '应用修改', exact: true }).click();
  await page.waitForFunction(() =>
    document
      .querySelector('textarea[aria-label="Markdown编辑器"]')
      ?.value.includes('成品AI润色正文'),
  );
  await page.getByRole('button', { name: '关闭对话框' }).click();
  const masked = await page.evaluate(() => window.notesApi.call('ai.get'));
  assert(masked.has_key && !JSON.stringify(masked).includes(mockKey));
  assert(!readFileSync(join(root, '.host/ai/connection.json'), 'utf8').includes(mockKey));
  const runtime = await app.evaluate(({ app }) => ({
    packaged: app.isPackaged,
    version: app.getVersion(),
    electron: process.versions.electron,
    node: process.versions.node,
  }));
  assert(runtime.packaged);
  assert.equal(runtime.version, JSON.parse(readFileSync('package.json', 'utf8')).version);
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(exe)) hash.update(chunk);
  const report = {
    date: new Date().toISOString(),
    pass: true,
    executable: exe,
    sha256: hash.digest('hex'),
    runtime,
    checks: [
      '成品EXE独立启动',
      '新建直接选择空白／模板并编辑',
      '安全Markdown预览',
      '自动持久化',
      '成品离线数学公式预览与真实PDF导出',
      '成品主色与纯色背景设置、带背景导出选项',
      '成品即时编辑与Markdown标题转换',
      '成品目录大纲、引用自动补全、自定义模板复用、收藏与置顶',
      '成品格式2完整备份生成',
      '成品AI聊天Agent工具调用、预览、编辑、新建与系统加密密钥',
      '实际打包标志与版本',
    ],
  };
  mkdirSync('reports', { recursive: true });
  writeFileSync('reports/packaged-test.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await app.close();
  mockAI.closeAllConnections();
  await new Promise((resolve) => mockAI.close(resolve));
}
