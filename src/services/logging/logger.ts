import type { LogLevel, LogSource } from "~/types/domain"
import { createId } from "~/utils/id"
import { maskSensitiveMetadata } from "~/utils/sensitive"
import { nowIso } from "~/utils/time"

import { db } from "~/db/schema"

export async function writeLog(input: {
  level: LogLevel
  source: LogSource
  message: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  await db.logs.add({
    id: createId("log"),
    timestamp: nowIso(),
    level: input.level,
    source: input.source,
    message: input.message,
    metadata: maskSensitiveMetadata(input.metadata)
  })
}

export function logInfo(
  source: LogSource,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  return writeLog({ level: "info", source, message, metadata })
}

export function logWarning(
  source: LogSource,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  return writeLog({ level: "warning", source, message, metadata })
}

export function logError(
  source: LogSource,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  return writeLog({ level: "error", source, message, metadata })
}
