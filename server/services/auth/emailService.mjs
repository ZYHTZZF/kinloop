import net from 'node:net'
import tls from 'node:tls'
import {
  SMTP_FROM,
  SMTP_HOST,
  SMTP_PASS,
  SMTP_PORT,
  SMTP_REQUIRE_TLS,
  SMTP_SECURE,
  SMTP_USER,
} from '../../config.mjs'

const SMTP_TIMEOUT_MS = 15000

function ensureEmailConfig() {
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    throw new Error('SMTP is not configured. Please set KINLOOP_SMTP_HOST/PORT/USER/PASS/FROM.')
  }
}

function debugLog(stage, extra = '') {
  const suffix = extra ? ` ${extra}` : ''
  console.log(`[smtp] ${stage}${suffix}`)
}

function withTimeout(promise, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer)
        reject(new Error(`SMTP timeout during ${label}`))
      }, SMTP_TIMEOUT_MS)
    }),
  ])
}

function createLineReader(socket) {
  let buffer = ''
  const pending = []

  socket.on('data', (chunk) => {
    buffer += chunk.toString('utf8')
    const parts = buffer.split(/\r?\n/)
    buffer = parts.pop() ?? ''
    for (const line of parts) {
      if (!line) continue
      const resolve = pending.shift()
      if (resolve) resolve(line)
    }
  })

  return () => new Promise((resolve) => pending.push(resolve))
}

async function readResponse(readLine, label) {
  const lines = []
  while (true) {
    const line = await withTimeout(readLine(), `read response for ${label}`)
    lines.push(line)
    if (/^\d{3}\s/.test(line)) {
      debugLog('recv', `${label} -> ${lines.join(' | ')}`)
      return { code: Number(line.slice(0, 3)), lines }
    }
  }
}

async function expectCode(readLine, expectedCodes, label) {
  const response = await readResponse(readLine, label)
  if (!expectedCodes.includes(response.code)) {
    throw new Error(`SMTP failed during ${label}: ${response.lines.join(' | ')}`)
  }
  return response
}

async function writeLine(socket, line, label) {
  debugLog('send', label)
  await withTimeout(new Promise((resolve, reject) => {
    socket.write(`${line}\r\n`, (error) => {
      if (error) reject(error)
      else resolve()
    })
  }), `write ${label}`)
}

async function writeRaw(socket, content, label) {
  debugLog('send', label)
  await withTimeout(new Promise((resolve, reject) => {
    socket.write(content, (error) => {
      if (error) reject(error)
      else resolve()
    })
  }), `write ${label}`)
}

async function upgradeToTls(socket) {
  debugLog('tls', 'starting STARTTLS upgrade')
  return await withTimeout(new Promise((resolve, reject) => {
    const secureSocket = tls.connect({
      socket,
      servername: SMTP_HOST,
      timeout: SMTP_TIMEOUT_MS,
    }, () => resolve(secureSocket))
    secureSocket.once('error', reject)
    secureSocket.once('timeout', () => reject(new Error('SMTP timeout during STARTTLS handshake')))
  }), 'STARTTLS handshake')
}

function extractEnvelopeAddress(value) {
  const match = /<([^>]+)>/.exec(value)
  return match?.[1] ?? value
}

function buildMessage({ to, subject, text, html }) {
  return [
    `From: ${SMTP_FROM}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    '',
    html ?? `<pre style="font-family: Arial, sans-serif">${text}</pre>`,
  ].join('\r\n')
}

async function openSmtpConnection() {
  ensureEmailConfig()
  debugLog('connect', `${SMTP_HOST}:${SMTP_PORT} secure=${SMTP_SECURE}`)

  const socket = await withTimeout(new Promise((resolve, reject) => {
    const nextSocket = SMTP_SECURE
      ? tls.connect({ host: SMTP_HOST, port: SMTP_PORT, servername: SMTP_HOST, timeout: SMTP_TIMEOUT_MS }, () => resolve(nextSocket))
      : net.connect({ host: SMTP_HOST, port: SMTP_PORT, timeout: SMTP_TIMEOUT_MS }, () => resolve(nextSocket))

    nextSocket.once('error', reject)
    nextSocket.once('timeout', () => reject(new Error('SMTP socket connect timeout')))
  }), 'connect')

  let activeSocket = socket
  let readLine = createLineReader(activeSocket)

  await expectCode(readLine, [220], 'server greeting')
  await writeLine(activeSocket, 'EHLO kinloop.local', 'EHLO')
  const ehlo = await expectCode(readLine, [250], 'EHLO response')
  const supportsStartTls = ehlo.lines.some((line) => /STARTTLS/i.test(line))

  if (!SMTP_SECURE && SMTP_REQUIRE_TLS) {
    if (!supportsStartTls) {
      throw new Error('SMTP server does not advertise STARTTLS.')
    }
    await writeLine(activeSocket, 'STARTTLS', 'STARTTLS')
    await expectCode(readLine, [220], 'STARTTLS response')
    activeSocket = await upgradeToTls(activeSocket)
    readLine = createLineReader(activeSocket)
    await writeLine(activeSocket, 'EHLO kinloop.local', 'EHLO after STARTTLS')
    await expectCode(readLine, [250], 'EHLO after STARTTLS response')
  }

  await writeLine(activeSocket, 'AUTH LOGIN', 'AUTH LOGIN')
  await expectCode(readLine, [334], 'AUTH LOGIN response')
  await writeLine(activeSocket, Buffer.from(SMTP_USER).toString('base64'), 'SMTP username')
  await expectCode(readLine, [334], 'SMTP username response')
  await writeLine(activeSocket, Buffer.from(SMTP_PASS).toString('base64'), 'SMTP password')
  await expectCode(readLine, [235], 'SMTP password response')

  return { socket: activeSocket, readLine }
}

export async function sendEmail({ to, subject, text, html }) {
  const { socket, readLine } = await openSmtpConnection()

  try {
    await writeLine(socket, `MAIL FROM:<${extractEnvelopeAddress(SMTP_FROM)}>`, 'MAIL FROM')
    await expectCode(readLine, [250], 'MAIL FROM response')
    await writeLine(socket, `RCPT TO:<${to}>`, 'RCPT TO')
    await expectCode(readLine, [250, 251], 'RCPT TO response')
    await writeLine(socket, 'DATA', 'DATA')
    await expectCode(readLine, [354], 'DATA response')
    await writeRaw(socket, `${buildMessage({ to, subject, text, html })}\r\n.\r\n`, 'message body')
    await expectCode(readLine, [250], 'message body response')
    await writeLine(socket, 'QUIT', 'QUIT')
    await expectCode(readLine, [221], 'QUIT response')
    debugLog('done', `sent to ${to}`)
  } finally {
    socket.end()
  }
}

export async function sendAuthCodeEmail({ email, code, purpose }) {
  const label = purpose === 'reset_password' ? '重置密码' : '注册验证'
  await sendEmail({
    to: email,
    subject: `Kinloop ${label}验证码`,
    text: `您的 Kinloop ${label}验证码是 ${code}，10 分钟内有效。`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #2f2f2f; line-height: 1.6;">
        <h2>Kinloop ${label}</h2>
        <p>您的验证码是：</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">${code}</p>
        <p>验证码 10 分钟内有效，请勿泄露给他人。</p>
      </div>
    `,
  })
}
