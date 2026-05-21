export function nowIso(): string {
  return new Date().toISOString()
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

export function hoursBetween(fromUnixSeconds: number, to = Date.now()): number {
  return Math.max(0, (to - fromUnixSeconds * 1000) / 3_600_000)
}

export function formatRelativeTime(iso?: string): string {
  if (!iso) return "Never"

  const delta = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(delta)) return "Unknown"

  const minutes = Math.round(delta / 60_000)
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  return `${Math.round(hours / 24)}d ago`
}
