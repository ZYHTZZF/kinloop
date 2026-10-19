import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

export function createPasswordHash(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return { salt, hash }
}

export function verifyPassword(password, salt, expectedHash) {
  const actual = scryptSync(password, salt, 64)
  const expected = Buffer.from(expectedHash, 'hex')
  if (actual.length !== expected.length) {
    return false
  }
  return timingSafeEqual(actual, expected)
}
