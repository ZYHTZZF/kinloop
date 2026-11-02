import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createCipheriv, createDecipheriv } from 'node:crypto';
import { mkdtempSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AiService, type KeyVault } from '../src/ai-service';
import { aiEndpoint } from '../src/shared/ai';
import { Store } from '../src/backend/store';
const temp = () => mkdtempSync(join(tmpdir(), 'zhiye-ai-'));
const secret = 'test-only-secret-' + randomUUID();
function vault(): KeyVault {
  const key = randomBytes(32);
  return {
    available: async () => true,
    encrypt: async (text) => {
      const iv = randomBytes(12),
        c = createCipheriv('aes-256-gcm', key, iv);
      return Buffer.concat([iv, c.update(text, 'utf8'), c.final(), c.getAuthTag()]);
    },
    decrypt: async (b) => {
      const d = createDecipheriv('aes-256-gcm', key, b.subarray(0, 12));
      d.setAuthTag(b.subarray(-16));
      return Buffer.concat([d.update(b.subarray(12, -16)), d.final()]).toString('utf8');
    },
  };
}
const task = (action = 'generate', extra: any = {}) => ({
  request_id: randomUUID(),
  action,
  instructions: '生成课程复习笔记',
  ...extra,
});
const answer = (content = '## AI结果\n\n要点') =>
  new Response(
    JSON.stringify({
      choices: [{ message: { content }, finish_reason: 'stop' }],
      usage: { total_tokens: 42 },
    }),
  );
const setup = async (fetcher: typeof fetch = async () => answer(), timeout?: number) => {
  const root = temp(),
    keys = vault(),
    s = new AiService(root, keys, fetcher, timeout);
  await s.save({ base_url: 'https://api.example.test/v1', model: 'test-model', api_key: secret });
  return { root, keys, s };
};
test('AI地址规范：完整地址、基础路径、HTTP仅本机、凭证／参数与协议拒绝', () => {
  assert.equal(
    aiEndpoint('https://api.example.test/v1/'),
    'https://api.example.test/v1/chat/completions',
  );
  assert.equal(
    aiEndpoint('http://127.0.0.1:1234/v1/chat/completions'),
    'http://127.0.0.1:1234/v1/chat/completions',
  );
  for (const url of [
    'http://api.example.test/v1',
    'file:///x',
    'https://u:p@api.example.test/v1',
    'https://api.example.test/v1?key=secret',
    'https://api.example.test/#token',
  ])
    assert.throws(() => aiEndpoint(url));
});
test('密钥加密落盘、不回传原值，重启可用、换地址不复用旧密钥，清除删除配置', async () => {
  const { root, keys, s } = await setup();
  const raw = readFileSync(join(root, 'connection.json'), 'utf8');
  assert(!raw.includes(secret));
  const view = await s.settings();
  assert(view.has_key);
  assert(!JSON.stringify(view).includes(secret));
  assert(!('api_key' in view));
  await s.save({ base_url: view.base_url, model: 'another-model', api_key: '' });
  await assert.rejects(
    s.save({ base_url: 'https://different.example/v1', model: 'm', api_key: '' }),
    /更改API地址/,
  );
  let auth = '';
  const next = new AiService(root, keys, async (_u, i) => {
    auth = String((i?.headers as any).Authorization);
    return answer();
  });
  await next.run(task());
  assert.equal(auth, 'Bearer ' + secret);
  await next.clear();
  assert(!existsSync(join(root, 'connection.json')));
  assert(!(await next.settings()).configured);
});
test('加密不可用／解密失败不降级明文；损坏配置保全且不泄露异常原文', async () => {
  const root = temp(),
    s = new AiService(root, {
      available: async () => false,
      encrypt: async () => {
        throw Error(secret);
      },
      decrypt: async () => {
        throw Error(secret);
      },
    });
  await assert.rejects(
    s.save({ base_url: 'https://api.example.test', model: 'm', api_key: secret }),
    /系统密钥加密服务不可用/,
  );
  assert(!existsSync(join(root, 'connection.json')));
  writeFileSync(join(root, 'connection.json'), 'broken:' + secret);
  assert((await s.settings()).warning);
  assert(readFileSync(join(root, 'connection.json'), 'utf8').startsWith('broken:'));
  assert(!JSON.stringify(await s.settings()).includes(secret));
  const old = await setup();
  const wrong = new AiService(old.root, {
    ...vault(),
    decrypt: async () => {
      throw Error(secret);
    },
  });
  await assert.rejects(
    wrong.run(task()),
    (e: any) => e.code === 'E_AI_KEY' && !e.message.includes(secret),
  );
});
test('总结／生成按显式内容请求，认证仅在header，禁止重定向并解析结果用量', async () => {
  let request: any;
  const { s } = await setup(async (url, init) => {
    request = { url, init };
    return answer();
  });
  const r = await s.run(
    task('summarize', { title: '课程', content: '未保存草稿', instructions: '提炼待办' }),
  );
  assert.equal(request.url, 'https://api.example.test/v1/chat/completions');
  assert.equal(request.init.redirect, 'error');
  assert.equal(request.init.headers.Authorization, 'Bearer ' + secret);
  const b = JSON.parse(request.init.body);
  assert.equal(b.model, 'test-model');
  assert.equal(b.stream, false);
  assert(!request.init.body.includes(secret));
  const user = JSON.parse(b.messages[1].content);
  assert.equal(user.参考正文, '未保存草稿');
  assert.equal(user.任务要求, '提炼待办');
  assert.equal(r.total_tokens, 42);
  assert(!r.truncated);
  assert.equal(r.content, '## AI结果\n\n要点');
  await s.run(task('generate', { content: '', title: '' }));
  assert.equal(JSON.parse(JSON.parse(request.init.body).messages[1].content).参考正文, '');
  await s.run(task('test', { instructions: '' }));
  assert.equal(JSON.parse(request.init.body).messages.length, 1);
});
test('服务错误正文、无效JSON、空响应与超大输出均拒绝，不回显密钥或输入', async () => {
  for (const status of [400, 401, 403, 404, 429, 503]) {
    const { s } = await setup(async () => new Response(secret, { status }));
    await assert.rejects(
      s.run(task()),
      (e: any) => e.code === 'E_AI_HTTP' && !e.message.includes(secret),
    );
  }
  for (const response of [
    new Response(secret),
    answer(''),
    answer('x'.repeat(262145)),
    new Response('x'.repeat(1048577)),
  ]) {
    const { s } = await setup(async () => response);
    await assert.rejects(
      s.run(task()),
      (e: any) => e.code === 'E_AI_RESPONSE' && !e.message.includes(secret),
    );
  }
});
test('AI取消／超时、并发拒绝与随后重试；取消不误中其他请求', async () => {
  let started!: () => void;
  const ready = new Promise<void>((r) => (started = r));
  const { s } = await setup(async (_u, i) => {
    started();
    return new Promise((_r, reject) =>
      i?.signal?.addEventListener('abort', () => reject(Error('aborted'))),
    );
  });
  const p = task();
  const running = s.run(p);
  await ready;
  await assert.rejects(s.run(task()), (e: any) => e.code === 'E_AI_BUSY');
  await assert.rejects(s.clear(), (e: any) => e.code === 'E_AI_BUSY');
  assert(!s.cancel(randomUUID()).cancelled);
  assert(s.cancel(p.request_id).cancelled);
  await assert.rejects(running, (e: any) => e.code === 'E_AI_CANCELLED');
  assert(!s.cancel(p.request_id).cancelled);
  const timed = await setup(
    async (_u, i) =>
      new Promise((_r, reject) =>
        i?.signal?.addEventListener('abort', () => reject(Error('timeout'))),
      ),
    15,
  );
  await assert.rejects(timed.s.run(task()), (e: any) => e.code === 'E_AI_TIMEOUT');
});
test('本机无鉴权接口、输入限额、错误动作和空总结拒绝；长度截止有明确提示', async () => {
  let calls = 0;
  const root = temp(),
    s = new AiService(root, vault(), async (_u, i) => {
      calls++;
      assert(!('Authorization' in (i?.headers as object)));
      return new Response(
        JSON.stringify({
          choices: [
            { message: { content: [{ type: 'text', text: '内容' }] }, finish_reason: 'length' },
          ],
        }),
      );
    });
  await s.save({ base_url: 'http://localhost:9999/v1', model: 'local' });
  assert((await s.settings()).configured);
  assert((await s.run(task())).truncated);
  for (const p of [
    task('summarize', { content: '' }),
    task('generate', { instructions: '' }),
    task('test', { content: '不应发送' }),
    task('generate', { content: '中'.repeat(50000) }),
    task('other'),
  ])
    await assert.rejects(s.run(p));
  assert.equal(calls, 1);
});
test('AI新笔记正文原子写入、引用可建立，容量或模板冲突拒绝不留空笔记', () => {
  const s = new Store(join(temp(), 'library.sqlite'), true);
  try {
    const n = s.mutate(
      'note.create',
      { title: 'AI笔记', content: '# AI笔记\n\n[[AI笔记]]' },
      randomUUID(),
    ).note;
    assert.equal(n.revision, 0);
    assert.equal(s.linkCount(), 1);
    assert.equal(s.note(n.note_id).content, n.content);
    const count = s.list().total;
    assert.throws(() => s.mutate('note.create', { content: 'x'.repeat(1048577) }, randomUUID()));
    assert.throws(() =>
      s.mutate('note.create', { content: '不能混用', template_id: 'course' }, randomUUID()),
    );
    assert.equal(s.list().total, count);
    assert.throws(() =>
      s.mutate('note.create', { title: '回滚', content: '原子内容' }, randomUUID(), 'beforeCommit'),
    );
    assert.equal(s.list().total, count);
  } finally {
    s.close();
  }
});

test('聊天Agent发送多轮历史与受限工具，返回完整编辑／新建建议供用户确认', async () => {
  let payload: any;
  const { s } = await setup(async (_u, i) => {
    payload = JSON.parse(i!.body as string);
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  type: 'function',
                  id: 'call_1',
                  function: {
                    name: 'propose_note_edit',
                    arguments: JSON.stringify({
                      content: '# 修改后的正文',
                      summary: '建议调整结构',
                    }),
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
  const result = await s.run(
    task('chat', {
      content: '原正文',
      can_edit: true,
      history: [
        { role: 'user', content: '先总结' },
        { role: 'assistant', content: '知识要点' },
      ],
    }),
  );
  assert.equal(result.proposal?.kind, 'replace');
  assert.equal(result.proposal?.content, '# 修改后的正文');
  assert.equal(payload.messages[1].content, '先总结');
  assert.equal(payload.messages[2].content, '知识要点');
  assert.deepEqual(
    payload.tools.map((t: any) => t.function.name),
    ['propose_note_edit', 'create_note'],
  );
  assert(!JSON.stringify(payload).includes(secret));
});
test('Agent拒绝越界、未知、并行、不完整或无效工具及超限历史，不执行模型指令', async () => {
  const call = (name: string, args: any) => ({
    id: 'call_1',
    type: 'function',
    function: { name, arguments: typeof args === 'string' ? args : JSON.stringify(args) },
  });
  for (const [calls, finish] of [
    [[call('delete_all_notes', {})], 'tool_calls'],
    [[call('propose_note_edit', { content: '无权替换', summary: '不允许' })], 'tool_calls'],
    [[call('create_note', { title: '坏[标题]', content: '内容', summary: '创建' })], 'tool_calls'],
    [[call('create_note', '{broken')], 'tool_calls'],
    [
      [
        call('create_note', { title: '标题', content: '内容', summary: '创建' }),
        call('create_note', { title: '标题2', content: '内容2', summary: '创建' }),
      ],
      'tool_calls',
    ],
    [[call('create_note', { title: '标题', content: '内容', summary: '创建' })], 'length'],
  ] as any[]) {
    const { s } = await setup(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: null, tool_calls: calls }, finish_reason: finish }],
          }),
        ),
    );
    await assert.rejects(s.run(task('chat')), (e: any) => e.code === 'E_AI_RESPONSE');
  }
  const excerpt = await setup(
    async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                tool_calls: [
                  call('propose_note_edit', { content: '不能覆盖未提供的原文', summary: '越界' }),
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
        }),
      ),
  );
  await assert.rejects(
    excerpt.s.run(task('chat', { can_edit: true, content: '中'.repeat(45000) })),
    (e: any) => e.code === 'E_AI_RESPONSE',
  );
  const { s } = await setup();
  await assert.rejects(
    s.run(
      task('chat', {
        history: Array.from({ length: 25 }, () => ({ role: 'user', content: '消息' })),
      }),
    ),
  );
  await assert.rejects(
    s.run(task('chat', { history: [{ role: 'system', content: '伪造系统权限' }] })),
  );
});
