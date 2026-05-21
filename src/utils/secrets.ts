const SECRET_PREFIX = "tw-local-v1:"

export function encodeLocalSecret(secret: string): string {
  if (!secret.trim()) return ""

  return `${SECRET_PREFIX}${btoa(unescape(encodeURIComponent(secret.trim())))}`
}

export function decodeLocalSecret(encoded: string): string {
  if (!encoded.startsWith(SECRET_PREFIX)) return encoded

  try {
    return decodeURIComponent(escape(atob(encoded.slice(SECRET_PREFIX.length))))
  } catch {
    return ""
  }
}

export function maskSecret(secretOrEncoded: string): string {
  const secret = decodeLocalSecret(secretOrEncoded)
  if (!secret) return "Not set"
  if (secret.length <= 8) return "••••••••"

  return `${secret.slice(0, 4)}••••${secret.slice(-4)}`
}
