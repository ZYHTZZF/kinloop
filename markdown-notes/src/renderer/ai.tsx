import React, { useEffect, useRef, useState } from 'react';
import { safeMarkdown } from './markdown';
import type { AiSettingsView, AiResult } from '../shared/ai';
import { prepareChatContext } from '../shared/ai-context';
import { Sparkles, X, Paperclip, Send, PanelRightClose } from 'lucide-react';
import {
  chatAttachments,
  attachmentInfo,
  FILE_ACCEPT,
  ATTACHMENT_COUNT,
  ATTACHMENT_TOTAL_BYTES,
  type AiAttachment,
  type AttachmentInfo,
} from '../shared/files';
import { readChatFile } from './file-input';
import './ai.css';
const api = window.notesApi;
const message = (e: any) => e?.message || '操作未完成，请重试';

export function AiSettings() {
  const [config, setConfig] = useState<AiSettingsView | null>(null),
    [url, setUrl] = useState(''),
    [model, setModel] = useState(''),
    [key, setKey] = useState('');
  const [contextTokens, setContextTokens] = useState(16384);
  const [busy, setBusy] = useState(''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const request = useRef<string | null>(null);
  const load = (p: AiSettingsView) => {
    setConfig(p);
    setUrl(p.base_url);
    setModel(p.model);
    setKey('');
    setContextTokens(p.context_tokens);
  };
  useEffect(() => {
    let alive = true;
    api
      .call('ai.get')
      .then((p) => {
        if (alive) load(p);
      })
      .catch((e) => {
        if (alive) setError(message(e));
      });
    return () => {
      alive = false;
      if (request.current)
        void api.call('ai.cancel', { request_id: request.current }).catch(() => {});
    };
  }, []);
  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy('');
    }
  };
  const changed =
    !config ||
    url !== config.base_url ||
    model !== config.model ||
    contextTokens !== config.context_tokens ||
    !!key;
  return (
    <div className="settings-content ai-settings">
      <h3>AI连接设置</h3>
      <p className="muted">
        使用你自己的OpenAI兼容服务。笔记仅在点击AI操作后发送到下方地址，费用和数据处理规则由服务方决定。
      </p>
      {error && (
        <p className="ai-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="ai-notice" role="status">
          {notice}
        </p>
      )}
      {config?.warning && (
        <p className="ai-error" role="alert">
          {config.warning}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run('正在保存配置', async () => {
            load(
              await api.call('ai.set', {
                base_url: url,
                model,
                api_key: key,
                context_tokens: contextTokens,
              }),
            );
            setNotice('AI配置已保存，密钥不会随笔记备份导出');
          });
        }}
      >
        <label>
          API地址
          <input
            aria-label="AI API地址"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={!config || !!busy}
            placeholder="https://api.example.com/v1"
            autoComplete="off"
          />
        </label>
        <p className="form-hint">
          填写基础地址（例如以 /v1 结尾）或完整 /chat/completions
          地址。远程服务使用HTTPS，本机服务可使用HTTP。
        </p>
        <label>
          模型名称
          <input
            aria-label="AI模型名称"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={!config || !!busy}
            placeholder="填写服务商提供的模型ID"
            autoComplete="off"
          />
        </label>
        <label>
          上下文输入预算（估算tokens）
          <input
            aria-label="AI上下文预算"
            type="number"
            min={4096}
            max={32768}
            step={1024}
            value={contextTokens}
            disabled={!config || !!busy}
            onChange={(e) => setContextTokens(Number(e.target.value))}
          />
        </label>
        <p className="form-hint">
          默认16384，可设4096—32768。根据模型窗口调整并为输出留空间；此值为保守估算，不等同于服务商精确分词。
        </p>
        <label>
          API Key
          <input
            aria-label="AI API Key"
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            disabled={!config || !!busy}
            placeholder={
              config?.has_key
                ? '已保存密钥，留空保留；填写新值替换'
                : '输入API Key（本机无鉴权服务可留空）'
            }
            autoComplete="new-password"
            spellCheck={false}
          />
        </label>
        <p className="form-hint">
          密钥经系统加密后仅存本机，不显示原值、不写入日志或笔记备份。更换API地址需重新填写密钥。
        </p>
        {config && !config.encryption_available && (
          <p className="ai-error">系统加密服务不可用，暂时不能保存新的API Key。</p>
        )}
        <div className="ai-actions">
          <button className="new-button" disabled={!config || !!busy}>
            保存AI配置
          </button>
          <button
            className="button"
            type="button"
            disabled={!config?.configured || changed || !!busy}
            onClick={() =>
              void run('正在测试连接', async () => {
                const id = crypto.randomUUID();
                request.current = id;
                try {
                  await api.call('ai.run', { request_id: id, action: 'test' });
                  setNotice('连接成功，服务已返回有效文本');
                } finally {
                  request.current = null;
                }
              })
            }
          >
            测试AI连接
          </button>
          <button
            className="button danger"
            type="button"
            disabled={!config || !!busy}
            onClick={() =>
              void run('正在清除配置', async () => {
                load(await api.call('ai.clear'));
                setNotice('AI配置与保存的密钥已清除');
              })
            }
          >
            清除配置与密钥
          </button>
          {busy === '正在测试连接' && (
            <button
              className="button"
              type="button"
              onClick={() => {
                if (request.current)
                  void api
                    .call('ai.cancel', { request_id: request.current })
                    .catch((e) => setError(message(e)));
              }}
            >
              取消测试
            </button>
          )}
        </div>
        {changed && config && (
          <p className="form-hint">
            先保存配置，再测试连接。测试只发送一条简短请求，不发送笔记，可能产生少量调用费用。
          </p>
        )}
        {!!busy && (
          <p className="muted" role="status">
            {busy}…
          </p>
        )}
      </form>
    </div>
  );
}

export type AiSource = { epoch: string; note_id?: string; title: string; content: string };
export type ChatTurn = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  result?: AiResult;
  source?: AiSource;
  status?: 'pending' | 'applied' | 'dismissed';
  attachments?: AttachmentInfo[];
};
export function AiAssistant({
  source,
  command,
  visible,
  configurationVersion,
  onClose,
  onConfigure,
  onAppend,
  onCreate,
  onReplace,
  memory,
}: {
  source: AiSource;
  command: { id: number; action: 'summarize' | 'generate' };
  visible: boolean;
  configurationVersion: number;
  onClose(): void;
  onConfigure(): void;
  onAppend(source: AiSource, text: string): Promise<void>;
  onCreate(source: AiSource, title: string, text: string): Promise<void>;
  onReplace(source: AiSource, text: string): Promise<void>;
  memory: React.RefObject<ChatTurn[]>;
}) {
  const [config, setConfig] = useState<AiSettingsView | null>(null),
    [turns, setTurns] = useState<ChatTurn[]>(memory.current),
    [input, setInput] = useState(''),
    [include, setInclude] = useState(!!source.note_id),
    [agent, setAgent] = useState(true),
    [busy, setBusy] = useState(false),
    [applying, setApplying] = useState(false),
    [error, setError] = useState('');
  const [nativePdf, setNativePdf] = useState(false);
  const [attachments, setAttachments] = useState<AiAttachment[]>([]),
    [reading, setReading] = useState(false),
    [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null),
    composer = useRef<HTMLTextAreaElement>(null),
    readingFlight = useRef(false);
  const request = useRef<string | null>(null),
    pending = useRef<string | null>(null),
    alive = useRef(true),
    flight = useRef(false),
    bottom = useRef<HTMLDivElement>(null);
  const change = (next: ChatTurn[]) => {
    memory.current = next;
    setTurns(next);
  };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (request.current)
        void api.call('ai.cancel', { request_id: request.current }).catch(() => {});
      if (pending.current) memory.current = memory.current.filter((t) => t.id !== pending.current);
    };
  }, []);
  useEffect(() => {
    if (!visible) return;
    let current = true;
    api
      .call('ai.get')
      .then((p) => {
        if (current) setConfig(p);
      })
      .catch((e) => {
        if (current) setError(message(e));
      });
    return () => {
      current = false;
    };
  }, [visible, configurationVersion]);
  useEffect(() => {
    if (visible) bottom.current?.scrollIntoView({ block: 'nearest' });
  }, [turns.length, busy, visible]);
  useEffect(() => {
    setInclude(!!source.note_id);
  }, [source.note_id]);
  useEffect(() => {
    if (command.action === 'summarize') setInput((text) => (text.trim() ? text : '总结这篇笔记'));
    composer.current?.focus();
  }, [command.id]);
  const addFiles = async (files: File[]) => {
    if (!files.length || flight.current || readingFlight.current) return;
    readingFlight.current = true;
    setReading(true);
    setError('');
    setDragging(false);
    try {
      if (
        files.length + attachments.length > ATTACHMENT_COUNT ||
        files.reduce((n, f) => n + f.size, 0) + attachments.reduce((n, f) => n + f.size, 0) >
          ATTACHMENT_TOTAL_BYTES
      )
        throw new Error('每个会话最多5个活动附件、共20 MiB；请先移除不需要的附件');
      const next: AiAttachment[] = [];
      for (const file of files) next.push(await readChatFile(file));
      if (alive.current) setAttachments((previous) => [...previous, ...next]);
    } catch (e) {
      if (alive.current) setError(message(e));
    } finally {
      readingFlight.current = false;
      if (alive.current) setReading(false);
    }
  };
  const [contextInfo, setContextInfo] = useState('');
  const send = async () => {
    const text =
      input.trim() || (attachments.length ? '请分析这些附件，提炼主要内容与关键结论。' : '');
    if (!text || flight.current || readingFlight.current) return;
    const history = turns.map((t) => ({
      ...t,
      ...(t.status === 'pending' ? { status: 'dismissed' as const } : {}),
    }));
    const lastDraft = turns.findLast((t) => t.status === 'pending' && t.result?.proposal);
    let packed, outgoing: AiAttachment[];
    try {
      outgoing = chatAttachments(attachments, nativePdf);
      packed = prepareChatContext(
        history.map((t) => ({
          role: t.role,
          content:
            (t.result?.proposal
              ? '操作状态：' + (t.status === 'applied' ? '已应用' : '未应用') + '\n'
              : '') +
            (t.source?.note_id ? '当时附带笔记：' + t.source.title + '\n' : '') +
            (t.attachments?.length
              ? '当时附件（历史记录，仅本轮附件列表中的文件实际发送）：' +
                t.attachments.map((f) => f.name).join('、') +
                '\n'
              : '') +
            t.text +
            (t.id === lastDraft?.id
              ? '\n上一稿正文（尚未应用）：\n' + t.result!.proposal!.content
              : ''),
        })),
        include ? source.content : '',
        text,
        include ? source.title : '',
        config?.context_tokens ?? 16384,
        outgoing,
      );
    } catch (e) {
      setError(message(e));
      return;
    }
    setContextInfo(
      '约 ' +
        packed.estimated_input_tokens +
        ' 输入tokens（含附件预留）' +
        (packed.omitted_history ? ' · 已压缩 ' + packed.omitted_history + ' 条历史' : '') +
        (!packed.note_complete ? ' · 笔记已节选，全文修改已禁用' : ''),
    );
    const user: ChatTurn = {
      id: crypto.randomUUID(),
      role: 'user',
      text,
      ...(include ? { source: { ...source } } : {}),
      attachments: attachments.map(attachmentInfo),
    };
    const snapshot = { ...source };
    flight.current = true;
    setBusy(true);
    setError('');
    setInput('');
    change([...history, user]);
    pending.current = user.id;
    const id = crypto.randomUUID();
    request.current = id;
    try {
      const result: AiResult = await api.call('ai.run', {
        request_id: id,
        action: 'chat',
        instructions: text,
        title: include ? source.title : '',
        content: packed.content,
        can_edit: include && !!source.note_id && packed.note_complete,
        agent,
        history: packed.history,
        context_note_full: packed.note_complete,
        attachments: outgoing,
      });
      if (alive.current) {
        if (result.context?.note_excerpt)
          setContextInfo((previous) =>
            previous.includes('已节选') ? previous : previous + ' · 笔记已节选，全文修改已禁用',
          );
        change([
          ...history,
          user,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: result.content,
            result,
            source: snapshot,
            ...(result.proposal ? { status: 'pending' as const } : {}),
          },
        ]);
      }
    } catch (e) {
      if (alive.current) {
        change(history);
        setInput(text);
        setError(message(e));
      }
    } finally {
      request.current = null;
      pending.current = null;
      flight.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const apply = async (turn: ChatTurn, kind: 'replace' | 'create' | 'append') => {
    if (flight.current || !turn.result || !turn.source) return;
    flight.current = true;
    setApplying(true);
    setError('');
    const proposal = turn.result.proposal,
      text = proposal?.content ?? turn.text;
    try {
      if (kind === 'replace') await onReplace(turn.source, text);
      else if (kind === 'create') await onCreate(turn.source, proposal?.title ?? 'AI笔记', text);
      else await onAppend(turn.source, text);
      if (alive.current)
        change(memory.current.map((t) => (t.id === turn.id ? { ...t, status: 'applied' } : t)));
    } catch (e) {
      if (alive.current) setError(message(e));
    } finally {
      flight.current = false;
      if (alive.current) setApplying(false);
    }
  };
  return (
    <div
      className={'ai-chat' + (dragging ? ' attachment-hover' : '')}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          e.stopPropagation();
          setDragging(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          e.stopPropagation();
          setDragging(false);
          void addFiles([...e.dataTransfer.files]);
        }
      }}
    >
      <div className="ai-panel-heading">
        <h2>
          <Sparkles size={17} /> AI助手
        </h2>
        <button
          className="icon"
          aria-label="收起AI聊天面板"
          title="收起面板，保留对话和正在进行的请求"
          onClick={onClose}
        >
          <PanelRightClose size={18} />
        </button>
      </div>
      <div className="ai-chat-top">
        <span>{config?.configured ? config.model : '尚未配置AI'}</span>
        <div>
          <button className="button" disabled={busy || applying} onClick={onConfigure}>
            AI设置
          </button>
          <button
            className="button"
            disabled={
              busy || applying || reading || (!turns.length && !input && !attachments.length)
            }
            onClick={() => {
              change([]);
              setInput('');
              setAttachments([]);
              setContextInfo('');
              setError('');
            }}
          >
            新对话
          </button>
        </div>
      </div>
      <p className="ai-chat-context">
        {source.note_id ? '当前笔记：' + source.title : '未选择笔记，可让AI生成一篇新笔记'}
      </p>
      <div className="ai-chat-messages" role="log" aria-label="AI聊天记录" aria-live="polite">
        {!turns.length && (
          <div className="ai-chat-empty">
            <h3>今天想整理什么？</h3>
            <p>边写边聊，也可以拖入图片、PDF或文字资料。修改会先预览，确认后保存。</p>
            <div className="ai-chat-suggestions">
              {[
                '总结这篇笔记',
                '润色这篇笔记，保持原意',
                '把这篇笔记整理成提纲',
                '写一篇学习计划笔记',
              ].map((text, i) => (
                <button
                  className="button"
                  key={text}
                  disabled={(i < 3 && !source.note_id) || busy}
                  onClick={() => setInput(text)}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((turn) => (
          <div className={'ai-chat-turn ' + turn.role} key={turn.id}>
            <small>
              {turn.role === 'user' ? '你' : 'Mark It Down助手'}
              {turn.role === 'user' && turn.source?.note_id ? ' · ' + turn.source.title : ''}
            </small>
            {!!turn.attachments?.length && (
              <div className="ai-sent-files">
                {turn.attachments.map((f) => (
                  <span key={f.id}>
                    <Paperclip size={12} />
                    {f.name}
                  </span>
                ))}
              </div>
            )}
            {turn.role === 'user' ? (
              <p>{turn.text}</p>
            ) : (
              <article
                className="markdown"
                aria-label="AI回复"
                dangerouslySetInnerHTML={{ __html: safeMarkdown(turn.text) }}
              />
            )}
            {turn.result?.truncated && (
              <p className="ai-error">回复达到服务输出上限，可能不完整，请核实。</p>
            )}
            {turn.result?.proposal && (
              <div className="ai-proposal">
                <strong>
                  {turn.result.proposal.kind === 'replace'
                    ? '建议修改当前笔记'
                    : '建议新建：' + turn.result.proposal.title}
                </strong>
                {turn.result.proposal.kind === 'create' && (
                  <label className="ai-proposal-title">
                    新笔记标题
                    <input
                      aria-label="AI新笔记标题"
                      value={turn.result.proposal.title ?? ''}
                      disabled={turn.status !== 'pending' || applying || busy}
                      onChange={(e) =>
                        change(
                          turns.map((t) =>
                            t.id === turn.id
                              ? {
                                  ...t,
                                  result: {
                                    ...t.result!,
                                    proposal: { ...t.result!.proposal!, title: e.target.value },
                                  },
                                }
                              : t,
                          ),
                        )
                      }
                    />
                  </label>
                )}
                {turn.result.proposal.kind === 'replace' && (
                  <details>
                    <summary>修改前全文</summary>
                    <pre>{turn.source?.content}</pre>
                  </details>
                )}
                <details open>
                  <summary>
                    查看{turn.result.proposal.kind === 'replace' ? '修改后' : '新笔记'}全文
                  </summary>
                  <article
                    className="markdown ai-proposal-preview"
                    aria-label="AI建议正文"
                    dangerouslySetInnerHTML={{ __html: safeMarkdown(turn.result.proposal.content) }}
                  />
                </details>
                {turn.status === 'pending' ? (
                  <div className="ai-actions">
                    <button
                      className="new-button"
                      disabled={busy || applying}
                      onClick={() => void apply(turn, turn.result!.proposal!.kind)}
                    >
                      {turn.result.proposal.kind === 'replace' ? '应用修改' : '创建这篇笔记'}
                    </button>
                    <button
                      className="button"
                      disabled={busy || applying}
                      onClick={() =>
                        change(
                          turns.map((t) => (t.id === turn.id ? { ...t, status: 'dismissed' } : t)),
                        )
                      }
                    >
                      放弃建议
                    </button>
                  </div>
                ) : (
                  <p className="ai-tool-status">
                    {turn.status === 'applied' ? '已应用' : '未应用'}
                  </p>
                )}
              </div>
            )}
            {turn.role === 'assistant' && !turn.result?.proposal && (
              <div className="ai-actions">
                {turn.status === 'applied' ? (
                  <span className="ai-tool-status">已保存到笔记</span>
                ) : (
                  <>
                    <button
                      className="button"
                      disabled={busy || applying || !turn.source?.note_id}
                      onClick={() => void apply(turn, 'append')}
                    >
                      追加到笔记
                    </button>
                    <button
                      className="button"
                      disabled={busy || applying}
                      onClick={() => void apply(turn, 'create')}
                    >
                      保存为笔记
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <p className="muted" role="status">
            正在思考…
          </p>
        )}
        <div ref={bottom} />
      </div>
      {error && (
        <p className="ai-error" role="alert">
          {error}
        </p>
      )}
      {contextInfo && (
        <p className="ai-context-budget" role="status">
          {contextInfo}
        </p>
      )}
      <div className="ai-chat-composer">
        <input
          ref={fileInput}
          type="file"
          accept={FILE_ACCEPT}
          multiple
          hidden
          aria-label="选择聊天附件"
          onChange={(e) => {
            void addFiles([...(e.currentTarget.files ?? [])]);
            e.currentTarget.value = '';
          }}
        />
        {!!attachments.length && (
          <div className="ai-attachments" aria-label="会话附件">
            <p>活动附件 · 后续消息继续附带，移除后不再发送</p>
            {attachments.map((file) => (
              <div className="ai-attachment" key={file.id}>
                {file.kind === 'image' ? <img src={file.data} alt="" /> : <Paperclip size={16} />}
                <span title={file.name}>
                  {file.name}
                  <small>
                    {Math.ceil(file.size / 1024)} KiB ·{' '}
                    {file.kind === 'pdf'
                      ? nativePdf
                        ? 'PDF原文件'
                        : file.extracted_text
                          ? 'PDF提取文字'
                          : '无文字，需原文件模式'
                      : file.kind === 'image'
                        ? '图片原生输入'
                        : '文字资料'}
                  </small>
                </span>
                <button
                  className="icon"
                  aria-label={'移除附件：' + file.name}
                  disabled={busy || applying || reading}
                  onClick={() => setAttachments((files) => files.filter((f) => f.id !== file.id))}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        {attachments.some((f) => f.kind === 'pdf') && (
          <label className="ai-pdf-option">
            <input
              type="checkbox"
              aria-label="PDF原文件"
              checked={nativePdf}
              disabled={busy || applying || reading}
              onChange={(e) => setNativePdf(e.target.checked)}
            />
            PDF原文件（需模型支持；默认本地提取文字）
          </label>
        )}
        <div className="ai-chat-options">
          <label>
            <input
              type="checkbox"
              checked={include}
              disabled={!source.note_id || busy || applying}
              onChange={(e) => setInclude(e.target.checked)}
            />
            附带当前笔记
          </label>
          <label>
            <input
              type="checkbox"
              checked={agent}
              disabled={busy || applying}
              onChange={(e) => setAgent(e.target.checked)}
            />
            允许提出编辑／新建操作
          </label>
        </div>
        <textarea
          aria-label="发给AI的消息"
          ref={composer}
          onPaste={(e) => {
            if (e.clipboardData.files.length) {
              e.preventDefault();
              void addFiles([...e.clipboardData.files]);
            }
          }}
          value={input}
          maxLength={8000}
          disabled={busy || applying}
          placeholder="例如：帮我把这一篇整理得更清晰…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === 'Enter' &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing &&
              e.nativeEvent.keyCode !== 229
            ) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <div className="ai-chat-send">
          <button
            className="icon"
            aria-label="添加聊天附件"
            title="添加图片、PDF或文字资料（也可拖入／粘贴图片）"
            disabled={busy || applying || reading}
            onClick={() => fileInput.current?.click()}
          >
            <Paperclip size={18} />
          </button>
          <small>{reading ? '正在读取附件…' : 'Enter发送 · Shift+Enter换行'}</small>
          {busy ? (
            <button
              className="button"
              onClick={() => {
                if (request.current)
                  void api
                    .call('ai.cancel', { request_id: request.current })
                    .catch((e) => setError(message(e)));
              }}
            >
              停止生成
            </button>
          ) : (
            <button
              className="new-button"
              disabled={
                !config?.configured || (!input.trim() && !attachments.length) || applying || reading
              }
              onClick={() => void send()}
            >
              <Send size={14} />
              发送
            </button>
          )}
        </div>
      </div>
      <p className="ai-attachment-hint">
        附件随消息发给当前AI服务。图片／PDF需模型支持；用量为估算。收起保留会话，退出软件后清空。
      </p>
    </div>
  );
}
