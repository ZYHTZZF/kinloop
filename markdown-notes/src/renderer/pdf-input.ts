import { getDocument, PDFWorker } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/** Local text extraction only: no PDF JavaScript, navigation, external resources or uploads. */
export async function readPdfText(bytes: Uint8Array) {
  const port = new Worker(workerUrl, { type: 'module' });
  const worker = PDFWorker.create({ port });
  const task = getDocument({
    data: bytes.slice(),
    worker,
    disableFontFace: true,
    stopAtErrors: true,
    useWorkerFetch: false,
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const pdf = await task.promise;
        let text = '',
          excerpt = pdf.numPages > 100;
        const max = Math.min(pdf.numPages, 100);
        for (let n = 1; n <= max; n++) {
          const page = await pdf.getPage(n),
            content = await page.getTextContent();
          const words = content.items
            .flatMap((item) => ('str' in item ? [item.str + (item.hasEOL ? '\n' : ' ')] : []))
            .join('');
          text += `\n【PDF第${n}页】\n${words}`;
          page.cleanup();
          if (new TextEncoder().encode(text).length > 100 * 1024) {
            text = new TextDecoder().decode(new TextEncoder().encode(text).slice(0, 100 * 1024));
            if (text.endsWith('\ufffd')) text = text.slice(0, -1);
            excerpt = true;
            break;
          }
        }
        const actual = text.replace(/【PDF第\d+页】/g, '').trim();
        return { text: actual ? text : '', excerpt };
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('PDF读取超过30秒，请缩小文件或使用原文件发送')),
          30_000,
        );
      }),
    ]);
  } catch (e: any) {
    if (e?.name === 'PasswordException') throw new Error('PDF有密码保护，请先解密后添加');
    throw new Error('PDF文字读取失败，请检查文件，或使用支持PDF的模型发送原文件');
  } finally {
    clearTimeout(timer);
    let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      task.destroy().catch(() => {}),
      new Promise<void>((resolve) => {
        cleanupTimer = setTimeout(resolve, 1000);
      }),
    ]);
    clearTimeout(cleanupTimer);
    worker.destroy();
    port.terminate();
  }
}
