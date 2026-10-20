import { createHash, randomBytes } from 'node:crypto'

export function createOpaqueToken() {
  return randomBytes(32).toString('base64url')
}

export function hashOpaqueToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

export function createOneTimeCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export function createEntityId(prefix) {
  return `${prefix}_${Date.now()}_${randomBytes(4).toString('hex')}`
}

export function createFamilyJoinCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'KIN'
  for (let index = 0; index < 6; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return code
}
