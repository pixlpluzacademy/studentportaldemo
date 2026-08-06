import { createHash, randomBytes } from 'crypto'

export function createResetToken() {
  return randomBytes(32).toString('hex')
}

export function hashResetToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function getAppBaseUrl(requestUrl?: string) {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')

  if (requestUrl) {
    try {
      return new URL(requestUrl).origin
    } catch {
      // fall through
    }
  }

  return 'http://localhost:3000'
}
