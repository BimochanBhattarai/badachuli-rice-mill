import { scrypt, randomBytes, timingSafeEqual } from 'crypto'
import { promisify } from 'util'

const scryptAsync = promisify(scrypt)

const PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 }

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(32)
  const hash = (await scryptAsync(pin, salt, PARAMS.keylen, {
    N: PARAMS.N,
    r: PARAMS.r,
    p: PARAMS.p
  })) as Buffer
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`
}

export async function verifyPin(storedHash: string, pin: string): Promise<boolean> {
  const parts = storedHash.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const salt = Buffer.from(parts[1], 'base64')
  const expected = Buffer.from(parts[2], 'base64')
  const derived = (await scryptAsync(pin, salt, PARAMS.keylen, {
    N: PARAMS.N,
    r: PARAMS.r,
    p: PARAMS.p
  })) as Buffer
  return timingSafeEqual(derived, expected)
}

export function validatePin(pin: string): string | null {
  if (!pin || pin.trim().length === 0) return 'PIN is required'
  if (pin.length < 4) return 'PIN must be at least 4 characters'
  if (pin.length > 32) return 'PIN must be 32 characters or fewer'
  return null
}
