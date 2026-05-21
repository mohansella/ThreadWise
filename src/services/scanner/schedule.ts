export const MIN_SCAN_INTERVAL_MINUTES = 5
export const DEFAULT_SCAN_INTERVAL_MINUTES = 30
export const SCAN_SCHEDULER_POLL_MINUTES = 1

export function normalizeScanIntervalMinutes(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SCAN_INTERVAL_MINUTES
  return Math.max(MIN_SCAN_INTERVAL_MINUTES, Math.round(value))
}
