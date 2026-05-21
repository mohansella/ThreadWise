const SENSITIVE_KEYS = new Set([
  "api_key",
  "apiKey",
  "api_key_encrypted_or_local",
  "authorization",
  "Authorization",
  "token",
  "password"
])

export function maskSensitiveMetadata<T>(value: T): T {
  if (!value || typeof value !== "object") return value

  if (Array.isArray(value)) {
    return value.map((item) => maskSensitiveMetadata(item)) as T
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_KEYS.has(key) ? "[masked]" : maskSensitiveMetadata(item)
    ])
  ) as T
}
