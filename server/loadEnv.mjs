import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ENV_FILES = ['.env.local', '.env']

function stripWrappingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  return value
}

function parseEnvFile(content) {
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()

    if (!line || line.startsWith('#')) {
      continue
    }

    const separatorIndex = line.indexOf('=')
    if (separatorIndex <= 0) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    const value = stripWrappingQuotes(line.slice(separatorIndex + 1).trim())

    if (key && process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

export function loadServerEnv() {
  const projectRoot = process.cwd()

  for (const fileName of ENV_FILES) {
    const filePath = resolve(projectRoot, fileName)
    if (!existsSync(filePath)) {
      continue
    }

    const content = readFileSync(filePath, 'utf8')
    parseEnvFile(content)
  }
}
