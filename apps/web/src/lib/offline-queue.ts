/**
 * Offline queue for PWA writes
 * Queues database writes when offline, flushes when back online
 * 
 * Used for:
 * - Persona selection
 * - Progress tracking
 * - Quiz attempts
 * - CGPA updates
 */

interface QueuedWrite {
  id: string
  timestamp: number
  table: string
  operation: 'update' | 'insert' | 'upsert'
  data: Record<string, unknown>
  filter?: Record<string, unknown>
}

const QUEUE_KEY = 'unify_offline_queue'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

/**
 * Add write to offline queue
 * Returns immediately, will sync when online
 */
export function queueWrite(
  table: string,
  operation: 'update' | 'insert' | 'upsert',
  data: Record<string, unknown>,
  filter?: Record<string, unknown>
): void {
  try {
    const queue = getQueue()
    const write: QueuedWrite = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      table,
      operation,
      data,
      filter
    }
    queue.push(write)
    saveQueue(queue)
    
    // Try immediate flush if online
    if (navigator.onLine) {
      void flushQueue()
    }
  } catch (err) {
    console.error('Queue write failed:', err)
  }
}

/**
 * Flush queued writes to Supabase
 * Called on:
 * - Window focus (user returns to app)
 * - Online event (network restored)
 * - Manual sync button
 */
export async function flushQueue(): Promise<{ flushed: number; failed: number }> {
  const queue = getQueue()
  if (!queue.length) return { flushed: 0, failed: 0 }
  
  // Lazy-load supabase to avoid circular deps
  const { supabaseBrowser } = await import('./supabase')
  const sb = supabaseBrowser()
  if (!sb) return { flushed: 0, failed: 0 }
  
  let flushed = 0
  let failed = 0
  const remaining: QueuedWrite[] = []
  
  for (const write of queue) {
    // Skip stale writes (older than 7 days)
    if (Date.now() - write.timestamp > MAX_AGE_MS) {
      console.warn('Skipping stale queued write:', write)
      continue
    }
    
    try {
      if (write.operation === 'update') {
        let q = sb.from(write.table).update(write.data)
        if (write.filter) {
          for (const [key, value] of Object.entries(write.filter)) {
            q = q.eq(key, value)
          }
        }
        const { error } = await q
        if (error) throw error
      } else if (write.operation === 'insert') {
        const { error } = await sb.from(write.table).insert(write.data)
        if (error) throw error
      } else if (write.operation === 'upsert') {
        const { error } = await sb.from(write.table).upsert(write.data)
        if (error) throw error
      }
      
      flushed++
    } catch (err) {
      console.error('Queued write failed:', write, err)
      remaining.push(write) // Keep for retry
      failed++
    }
  }
  
  saveQueue(remaining)
  return { flushed, failed }
}

/**
 * Get current queue size
 * Used for UI badge ("3 changes pending")
 */
export function getQueueSize(): number {
  return getQueue().length
}

/**
 * Clear queue (use with caution)
 * Only for manual user action after verification
 */
export function clearQueue(): void {
  try {
    localStorage.removeItem(QUEUE_KEY)
  } catch {
    // Ignore quota errors
  }
}

// Internal helpers

function getQueue(): QueuedWrite[] {
  try {
    const json = localStorage.getItem(QUEUE_KEY)
    if (!json) return []
    const queue = JSON.parse(json) as unknown
    return Array.isArray(queue) ? queue : []
  } catch {
    return []
  }
}

function saveQueue(queue: QueuedWrite[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  } catch (err) {
    console.error('Queue save failed (quota?):', err)
  }
}

// Auto-flush on window focus and online event
if (typeof window !== 'undefined') {
  window.addEventListener('focus', () => void flushQueue())
  window.addEventListener('online', () => void flushQueue())
}
