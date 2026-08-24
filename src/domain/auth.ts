import argon2 from 'argon2'

const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB — tuned for 4 GB target hardware
  timeCost: 3,
  parallelism: 1
}

export async function hashPin(pin: string): Promise<string> {
  return argon2.hash(pin, ARGON2_OPTIONS)
}

export async function verifyPin(hash: string, pin: string): Promise<boolean> {
  return argon2.verify(hash, pin)
}

export function validatePin(pin: string): string | null {
  if (!pin || pin.trim().length === 0) return 'PIN is required'
  if (pin.length < 4) return 'PIN must be at least 4 characters'
  if (pin.length > 32) return 'PIN must be 32 characters or fewer'
  return null
}
