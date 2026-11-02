import { z } from 'zod';

export const ATTACHMENT_FILE_BYTES = 8 * 1048576;
export const ATTACHMENT_TOTAL_BYTES = 20 * 1048576;
export const ATTACHMENT_COUNT = 5;
export const attachmentSchema = z
  .object({
    id: z.string().uuid(),
    name: z
      .string()
      .min(1)
      .max(240)
      .refine((s) => !/[\p{Cc}\\/]/u.test(s)),
    kind: z.enum(['image', 'pdf', 'text']),
    mime: z.enum(['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain']),
    size: z.number().int().min(1).max(ATTACHMENT_FILE_BYTES),
    data: z.string().max(Math.ceil(ATTACHMENT_FILE_BYTES / 3) * 4 + 100),
    extracted_text: z
      .string()
      .max(128 * 1024)
      .optional(),
    extracted_excerpt: z.boolean().optional(),
    extraction_error: z.string().max(240).optional(),
  })
  .strict();
export type AiAttachment = z.infer<typeof attachmentSchema>;
export type AttachmentInfo = Pick<AiAttachment, 'id' | 'name' | 'kind' | 'mime' | 'size'>;
export const attachmentInfo = ({ id, name, kind, mime, size }: AiAttachment): AttachmentInfo => ({
  id,
  name,
  kind,
  mime,
  size,
});
export const FILE_ACCEPT = '.png,.jpg,.jpeg,.webp,.pdf,.md,.markdown,.txt,.csv,.json';

export function chatAttachments(files: AiAttachment[], nativePdf: boolean) {
  return files.map((f): AiAttachment => {
    if (f.kind !== 'pdf' || nativePdf) return f;
    if (!f.extracted_text?.trim())
      throw new Error(
        f.extraction_error ||
          '此PDF未提取到文字，可能是扫描件；请转成图片，或勾选“PDF原文件”使用支持PDF的模型',
      );
    return {
      id: f.id,
      name: f.name,
      kind: 'text',
      mime: 'text/plain',
      size: f.size,
      data: `PDF文字提取（${f.extracted_excerpt ? '节选，有省略' : '已提取文字'}；不含图片、图表及版式，请勿声称已识别这些内容）：\n${f.extracted_text}`,
    };
  });
}

export function decodeText(data: Uint8Array) {
  const encoding =
    data[0] === 0xff && data[1] === 0xfe
      ? 'utf-16le'
      : data[0] === 0xfe && data[1] === 0xff
        ? 'utf-16be'
        : 'utf-8';
  let text: string;
  try {
    text = new TextDecoder(encoding, { fatal: true }).decode(data);
  } catch {
    throw new Error('文字编码无法识别，请先另存为UTF-8或带BOM的UTF-16文件');
  }
  if (text.includes('\0') || !text.isWellFormed()) throw new Error('文件含无效文字或二进制内容');
  return text;
}

export function importedTitle(filename: string) {
  const text = filename
    .replace(/\.(md|markdown)$/i, '')
    .replace(/[\p{Cc}\[\]\\/\u2028\u2029]/gu, ' ')
    .trim()
    .normalize('NFC');
  return [...(text || '导入笔记')].slice(0, 100).join('');
}
