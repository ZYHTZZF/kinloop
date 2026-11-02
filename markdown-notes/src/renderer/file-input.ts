import {
  attachmentSchema,
  ATTACHMENT_FILE_BYTES,
  decodeText,
  type AiAttachment,
} from '../shared/files';
export async function readChatFile(file: File): Promise<AiAttachment> {
  if (!file.size || file.size > ATTACHMENT_FILE_BYTES)
    throw new Error('每个附件须为非空文件，且不超过8 MiB');
  const ext = file.name.split('.').at(-1)?.toLowerCase();
  const mime = (
    {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      pdf: 'application/pdf',
    } as Record<string, AiAttachment['mime']>
  )[ext ?? ''];
  const text = ['md', 'markdown', 'txt', 'csv', 'json'].includes(ext ?? '');
  if (!mime && !text)
    throw new Error('支持PNG/JPEG/WebP、PDF、Markdown、TXT、CSV和JSON；暂不支持其他格式');
  const bytes = new Uint8Array(await file.arrayBuffer());
  let pdfText: { text: string; excerpt: boolean } | null = null,
    extractionError = '';
  if (mime === 'application/pdf') {
    try {
      pdfText = await (await import('./pdf-input')).readPdfText(bytes);
    } catch (e: any) {
      extractionError = e?.message || 'PDF文字读取失败，可改用原文件模式';
    }
  }
  let data: string;
  if (text) {
    if (file.size > 128 * 1024) throw new Error('单个文字附件最多128 KiB');
    data = decodeText(bytes);
  } else {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 32768)
      binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    data = `data:${mime};base64,${btoa(binary)}`;
  }
  return attachmentSchema.parse({
    id: crypto.randomUUID(),
    name: [...file.name.replace(/[\p{Cc}\\/]/gu, '_')].slice(0, 240).join(''),
    kind: text ? 'text' : mime === 'application/pdf' ? 'pdf' : 'image',
    mime: mime ?? 'text/plain',
    size: file.size,
    data,
    ...(pdfText ? { extracted_text: pdfText.text, extracted_excerpt: pdfText.excerpt } : {}),
    ...(extractionError ? { extraction_error: extractionError } : {}),
  });
}
