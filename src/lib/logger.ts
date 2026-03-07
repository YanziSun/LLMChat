// Wrapper around tauri-plugin-log, falls back to console when not in Tauri
let tauriLog: null | {
  error: (msg: string) => Promise<void>
  warn: (msg: string) => Promise<void>
  info: (msg: string) => Promise<void>
} = null

async function getTauriLog() {
  if (tauriLog) return tauriLog
  try {
    const mod = await import('@tauri-apps/plugin-log')
    tauriLog = { error: mod.error, warn: mod.warn, info: mod.info }
    return tauriLog
  } catch {
    return null
  }
}

// In-memory log queue (max 500 entries)
export type LogLevel = 'error' | 'warn' | 'info'

export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: number
}

const MAX_LOG_ENTRIES = 500
const logEntries: LogEntry[] = []

function pushEntry(level: LogLevel, message: string) {
  logEntries.push({ level, message, timestamp: Date.now() })
  if (logEntries.length > MAX_LOG_ENTRIES) {
    logEntries.splice(0, logEntries.length - MAX_LOG_ENTRIES)
  }
}

export function getLogEntries(): LogEntry[] {
  return [...logEntries]
}

export function clearLogEntries() {
  logEntries.splice(0, logEntries.length)
}

export async function logError(msg: string) {
  console.error('[LLMChat]', msg)
  pushEntry('error', msg)
  const log = await getTauriLog()
  await log?.error(msg)
}

export async function logInfo(msg: string) {
  console.info('[LLMChat]', msg)
  pushEntry('info', msg)
  const log = await getTauriLog()
  await log?.info(msg)
}

export async function logWarn(msg: string) {
  console.warn('[LLMChat]', msg)
  pushEntry('warn', msg)
  const log = await getTauriLog()
  await log?.warn(msg)
}
