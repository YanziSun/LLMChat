import { useState, useEffect } from 'react'
import { Trash2, RefreshCw } from 'lucide-react'
import { getLogEntries, clearLogEntries } from '../../lib/logger'
import type { LogEntry, LogLevel } from '../../lib/logger'

const LEVEL_STYLES: Record<LogLevel, { badge: string; text: string }> = {
  error: { badge: 'bg-red-900/60 text-red-300 border border-red-700/50', text: 'text-red-200' },
  warn:  { badge: 'bg-yellow-900/60 text-yellow-300 border border-yellow-700/50', text: 'text-yellow-100' },
  info:  { badge: 'bg-slate-700/60 text-slate-300 border border-slate-600/50', text: 'text-slate-300' },
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`
}

type Filter = 'all' | LogLevel

export function LogViewer() {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [filter, setFilter] = useState<Filter>('all')

  const refresh = () => setEntries(getLogEntries())

  useEffect(() => {
    refresh()
    // Refresh every 2s to pick up new log entries
    const id = setInterval(refresh, 2000)
    return () => clearInterval(id)
  }, [])

  const handleClear = () => {
    clearLogEntries()
    setEntries([])
  }

  const filtered = filter === 'all' ? entries : entries.filter(e => e.level === filter)
  const counts = {
    error: entries.filter(e => e.level === 'error').length,
    warn: entries.filter(e => e.level === 'warn').length,
    info: entries.filter(e => e.level === 'info').length,
  }

  const filters: { key: Filter; label: string; count?: number }[] = [
    { key: 'all', label: '全部', count: entries.length },
    { key: 'error', label: 'Error', count: counts.error },
    { key: 'warn', label: 'Warn', count: counts.warn },
    { key: 'info', label: 'Info', count: counts.info },
  ]

  return (
    <div className="flex flex-col flex-1 min-h-0 p-6">
      <div className="max-w-4xl mx-auto w-full flex flex-col flex-1 min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">日志</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              title="刷新"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-[#1e293b] transition-colors"
            >
              <RefreshCw size={13} />
              刷新
            </button>
            <button
              onClick={handleClear}
              title="清空日志"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-400 px-2.5 py-1.5 rounded-lg hover:bg-[#1e293b] transition-colors"
            >
              <Trash2 size={13} />
              清空
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mb-3">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                filter === f.key
                  ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-[#1e293b]'
              }`}
            >
              {f.label}
              {f.count !== undefined && f.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  f.key === 'error' ? 'bg-red-900/60 text-red-300' :
                  f.key === 'warn' ? 'bg-yellow-900/60 text-yellow-300' :
                  'bg-slate-700 text-slate-400'
                }`}>{f.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Log list */}
        <div className="flex-1 overflow-y-auto bg-[#0a1020] rounded-xl border border-[#1e293b] font-mono text-xs">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-slate-600">
              {entries.length === 0 ? '暂无日志' : '该级别无日志'}
            </div>
          ) : (
            <div className="divide-y divide-[#1e293b]">
              {[...filtered].reverse().map((entry, idx) => {
                const style = LEVEL_STYLES[entry.level]
                return (
                  <div key={idx} className="flex gap-3 px-4 py-2.5 hover:bg-[#0f1929] transition-colors">
                    <span className="text-slate-600 flex-shrink-0 pt-0.5 w-[84px]">
                      {formatTime(entry.timestamp)}
                    </span>
                    <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase h-fit ${style.badge}`}>
                      {entry.level}
                    </span>
                    <span className={`${style.text} whitespace-pre-wrap break-all leading-relaxed`}>
                      {entry.message}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
