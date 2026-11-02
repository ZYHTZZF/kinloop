import { attachmentSchema, ATTACHMENT_TOTAL_BYTES, type AiAttachment } from './shared/files';
import { fail, bytes } from './shared/rules';

/** Only explicit file bytes cross IPC; never accept arbitrary filesystem paths or remote URLs. */
export function validateAttachments(input: AiAttachment[]) {
  const files = input.map((f) => attachmentSchema.parse(f));
  if (
    new Set(files.map((f) => f.id)).size !== files.length ||
    files.reduce((n, f) => n + f.size, 0) > ATTACHMENT_TOTAL_BYTES
  )
    fail('E_INPUT', '附件重复或总大小超过20 MiB');
  for (const f of files) {
    if (f.kind === 'text') {
      if (
        f.mime !== 'text/plain' ||
        !f.data.isWellFormed() ||
        f.data.includes('\0') ||
        bytes(f.data) > 128 * 1024
      )
        fail('E_INPUT', '文字附件无效或超过128 KiB');
      continue;
    }
    if ((f.kind === 'pdf') !== (f.mime === 'application/pdf')) fail('E_INPUT', '附件类型不匹配');
    const prefix = `data:${f.mime};base64,`;
    if (!f.data.startsWith(prefix)) fail('E_INPUT', '附件数据格式无效');
    const raw = f.data.slice(prefix.length);
    const data = Buffer.from(raw, 'base64');
    if (data.length !== f.size || data.toString('base64') !== raw)
      fail('E_INPUT', '附件长度或编码无效');
    const valid =
      f.mime === 'application/pdf'
        ? data.subarray(0, 5).toString() === '%PDF-'
        : f.mime === 'image/png'
          ? data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : f.mime === 'image/jpeg'
            ? data[0] === 255 && data[1] === 216 && data[2] === 255
            : data.subarray(0, 4).toString() === 'RIFF' &&
              data.subarray(8, 12).toString() === 'WEBP';
    if (!valid) fail('E_INPUT', '附件内容与声明格式不符，请选择有效图片或PDF');
  }
  return files;
}
