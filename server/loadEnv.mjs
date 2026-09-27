import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function parseEnvLine(line) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return null

  const eqIndex = trimmed.indexOf('=')
  if (eqIndex <= 0) return null

  const key = trimmed.slice(0, eqIndex).trim()
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null

  let value = trimmed.slice(eqIndex + 1).trim()
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1)
  }

  return { key, value }
}

export function loadServerEnv() {
  const cwd = process.cwd()
  const candidates = [resolve(cwd, '.env.local'), resolve(cwd, '.env')]

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue

    const lines = readFileSync(filePath, 'utf8').split(/\r?\n/)
    for (const line of lines) {
      const parsed = parseEnvLine(line)
      if (!parsed) continue
      if (process.env[parsed.key] != null && process.env[parsed.key] !== '') continue
      process.env[parsed.key] = parsed.value
    }
  }
}

