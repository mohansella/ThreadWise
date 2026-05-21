import { db } from "~/db/schema"

export async function deleteWatcher(watcherId: string): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.watchers,
      db.subredditSources,
      db.aiScores,
      db.feedback,
      db.preferenceMemory,
      db.notificationHistory,
      db.scanRuns,
      db.mutedPatterns,
      db.aiQueue,
      db.logs
    ],
    async () => {
      await db.subredditSources.where("watcher_id").equals(watcherId).delete()
      await db.aiScores.where("watcher_id").equals(watcherId).delete()
      await db.feedback.where("watcher_id").equals(watcherId).delete()
      await db.preferenceMemory.where("watcher_id").equals(watcherId).delete()
      await db.notificationHistory.where("watcher_id").equals(watcherId).delete()
      await db.scanRuns.where("watcher_id").equals(watcherId).delete()
      await db.mutedPatterns.where("watcher_id").equals(watcherId).delete()
      await db.aiQueue.where("watcher_id").equals(watcherId).delete()

      const watcherLogIds = (await db.logs.toArray())
        .filter((log) => hasWatcherMetadata(log.metadata, watcherId))
        .map((log) => log.id)
      await db.logs.bulkDelete(watcherLogIds)

      await db.watchers.delete(watcherId)
    }
  )
}

function hasWatcherMetadata(metadata: unknown, watcherId: string): boolean {
  if (!metadata || typeof metadata !== "object") return false
  const record = metadata as Record<string, unknown>
  return record.watcher_id === watcherId
}
