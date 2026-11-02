import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('文件拖入与选择导入Markdown：草稿保存、中文编码、同名编号、批量失败无部分写入、重启保留', async () => {
  const root = mkdtempSync(join(tmpdir(), 'mark-import-ui-'));
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    MARKITDOWN_DATA_DIR: root,
  };
  delete env.ELECTRON_RUN_AS_NODE;
  const launch = () => electron.launch({ args: ['.'], cwd: process.cwd(), env });
  let app = await launch();
  try {
    let page = await app.firstWindow();
    await expect(page.getByRole('button', { name: '新建笔记', exact: true })).toBeEnabled();
    await page.evaluate(() =>
      window.notesApi.call('note.create', { title: '课程', content: '原文' }),
    );
    await page.locator('.note-card').filter({ hasText: '课程' }).click();
    await page.getByRole('textbox', { name: 'Markdown编辑器' }).fill('导入之前尚未保存的草稿');
    const content = '# 拖入的笔记\r\n\r\n公式 $x^2$\r\n[[第二篇]]';
    const data = await page.evaluateHandle((text) => {
      const data = new DataTransfer();
      data.items.add(new File([text], '课程.md', { type: 'text/markdown' }));
      data.items.add(new File(['第二篇资料'], '第二篇.markdown', { type: 'text/markdown' }));
      return data;
    }, content);
    await page.locator('.workspace').dispatchEvent('dragover', { dataTransfer: data });
    await expect(page.locator('.import-drop-hint')).toBeVisible();
    await page.locator('.workspace').dispatchEvent('drop', { dataTransfer: data });
    await expect(page.locator('.note-card')).toHaveCount(3);
    await expect(page.locator('.document-heading h1')).toHaveText('第二篇');
    await page.locator('.note-card').filter({ hasText: '课程 (1)' }).click();
    // Textareas normalize CRLF for display; the imported backend retains the original bytes.
    await expect(page.getByRole('textbox', { name: 'Markdown编辑器' })).toHaveValue(
      content.replace(/\r\n/g, '\n'),
    );
    const notes = await page.evaluate(() => window.notesApi.call('note.list'));
    const original = notes.items.find((n: any) => n.title === '课程');
    expect(
      (
        await page.evaluate(
          (id) => window.notesApi.call('note.get', { note_id: id }),
          original.note_id,
        )
      ).content,
    ).toBe('导入之前尚未保存的草稿');
    const imported = notes.items.find((n: any) => n.title === '课程 (1)');
    expect(
      (
        await page.evaluate(
          (id) => window.notesApi.call('note.get', { note_id: id }),
          imported.note_id,
        )
      ).content,
    ).toBe(content);
    await page.locator('input[aria-label="选择Markdown文件"]').setInputFiles([
      { name: '有效.md', mimeType: 'text/markdown', buffer: Buffer.from('有效内容') },
      { name: '无效.md', mimeType: 'text/markdown', buffer: Buffer.from([255, 255, 0]) },
    ]);
    await expect(page.getByRole('status').filter({ hasText: '编码无法识别' })).toBeVisible();
    expect((await page.evaluate(() => window.notesApi.call('note.list'))).total).toBe(3);
    await page.locator('input[aria-label="选择Markdown文件"]').setInputFiles({
      name: 'UTF16.md',
      mimeType: 'text/markdown',
      buffer: Buffer.concat([Buffer.from([255, 254]), Buffer.from('中文UTF16笔记', 'utf16le')]),
    });
    await expect(page.locator('.document-heading h1')).toHaveText('UTF16');
    await page.getByRole('button', { name: 'AI助手', exact: true }).click();
    const attachment = await page.evaluateHandle(() => {
      const data = new DataTransfer();
      data.items.add(new File(['作为聊天附件'], '聊天.md', { type: 'text/markdown' }));
      return data;
    });
    await page.locator('.ai-chat').dispatchEvent('drop', { dataTransfer: attachment });
    await expect(page.locator('.ai-attachment')).toHaveCount(1);
    await page
      .locator('input[aria-label="选择聊天附件"]')
      .setInputFiles({
        name: '不可提取.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4\nbroken synthetic fixture'),
      });
    await expect(page.locator('.ai-attachment')).toHaveCount(2);
    await expect(page.locator('.ai-attachment').last()).toContainText('需原文件模式');
    await page.getByRole('checkbox', { name: 'PDF原文件', exact: true }).check();
    await expect(page.locator('.ai-attachment').last()).toContainText('PDF原文件');
    expect((await page.evaluate(() => window.notesApi.call('note.list'))).total).toBe(4);
    await app.close();
    app = await launch();
    page = await app.firstWindow();
    await expect(page.locator('.note-card')).toHaveCount(4);
    await page.locator('.note-card').filter({ hasText: 'UTF16' }).click();
    await expect(page.getByRole('textbox', { name: 'Markdown编辑器' })).toHaveValue(
      '中文UTF16笔记',
    );
  } finally {
    await app.close();
  }
});
