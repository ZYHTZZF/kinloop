import { z } from 'zod';
export const AI_INPUT_BYTES = 128 * 1024;
export const AI_OUTPUT_BYTES = 256 * 1024;
export function aiEndpoint(value: string) {
  const url = new URL(value.trim());
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error('API地址须为HTTPS，只有本机地址可使用HTTP；不能包含账号、查询参数或片段');
  url.pathname = url.pathname.replace(/\/+$/, '');
  if (!url.pathname.endsWith('/chat/completions')) url.pathname += '/chat/completions';
  return url.href;
}
export const aiConfigSchema = z
  .object({
    base_url: z
      .string()
      .max(2048)
      .transform((value) => aiEndpoint(value)),
    context_tokens: z.number().int().min(4096).max(32768).default(16384),
    model: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .refine((value) => !/[\p{Cc}\p{Zl}\p{Zp}]/u.test(value)),
    api_key: z
      .string()
      .max(4096)
      .refine((value) => !/\s|[\p{Cc}]/u.test(value))
      .optional(),
  })
  .strict();
export const aiTaskSchema = z
  .object({
    request_id: z.string().uuid(),
    action: z.enum(['summarize', 'generate', 'test', 'chat']),
    title: z.string().max(200).default(''),
    content: z.string().max(1048576).default(''),
    instructions: z.string().max(8000).default(''),
    history: z
      .array(
        z
          .object({ role: z.enum(['user', 'assistant']), content: z.string().max(AI_OUTPUT_BYTES) })
          .strict(),
      )
      .max(24)
      .default([]),
    context_note_full: z.boolean().default(true),
    can_edit: z.boolean().default(false),
    agent: z.boolean().default(true),
  })
  .strict();
export type AiTask = z.infer<typeof aiTaskSchema>;
export interface AiSettingsView {
  base_url: string;
  model: string;
  has_key: boolean;
  encryption_available: boolean;
  context_tokens: number;
  configured: boolean;
  warning?: string;
}
export interface AiResult {
  content: string;
  model: string;
  endpoint: string;
  truncated: boolean;
  total_tokens?: number;
  context?: { estimated_input_tokens: number; omitted_history: number; note_excerpt: boolean };
  proposal?: { kind: 'replace' | 'create'; content: string; summary: string; title?: string };
}
