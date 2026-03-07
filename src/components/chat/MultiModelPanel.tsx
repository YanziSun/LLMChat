import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import { X, EyeOff, Copy, Check } from 'lucide-react'
import type { Components } from 'react-markdown'
import type { Message } from '../../types'
import { useModelStore } from '../../stores/modelStore'

interface ModelColumn {
  modelId: string
  messages: Message[]
  streaming: boolean
  hidden: boolean
}

interface MultiModelPanelProps {
  columns: ModelColumn[]
  onHideColumn: (modelId: string) => void
  onShowColumn: (modelId: string) => void
}

function PanelCodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="my-2 rounded-lg overflow-hidden border border-[#2d3f55]">
      <div className="flex items-center justify-between px-3 py-1 bg-[#0d1b2a] border-b border-[#2d3f55]">
        <span className="text-xs text-slate-400 font-mono">{language || 'code'}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors px-1.5 py-0.5 rounded hover:bg-[#1e293b]"
        >
          {copied ? <><Check size={11} />Copied</> : <><Copy size={11} />Copy</>}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 bg-[#0f1923] text-xs leading-relaxed m-0">
        <code className={language ? `language-${language}` : ''}>{code}</code>
      </pre>
    </div>
  )
}

const panelComponents: Components = {
  code({ className, children }) {
    const match = /language-(\w+)/.exec(className ?? '')
    const isBlock = !!match || (typeof children === 'string' && (children as string).includes('\n'))
    const codeText = String(children).replace(/\n$/, '')
    if (isBlock) return <PanelCodeBlock language={match?.[1] ?? ''} code={codeText} />
    return <code className="bg-[#1e2d3d] text-[#7dd3fc] px-1 py-0.5 rounded text-[0.82em] font-mono">{children}</code>
  },
  pre({ children }) { return <>{children}</> },
  p({ children }) { return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p> },
  ul({ children }) { return <ul className="list-disc list-outside ml-4 mb-2 space-y-0.5">{children}</ul> },
  ol({ children }) { return <ol className="list-decimal list-outside ml-4 mb-2 space-y-0.5">{children}</ol> },
  strong({ children }) { return <strong className="font-semibold text-white">{children}</strong> },
  a({ href, children }) {
    return <a href={href} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 underline">{children}</a>
  },
  table({ children }) {
    return <div className="overflow-x-auto my-2"><table className="w-full text-xs border-collapse">{children}</table></div>
  },
  th({ children }) { return <th className="px-2 py-1 text-left text-slate-300 font-medium border border-[#334155] bg-[#1e293b]">{children}</th> },
  td({ children }) { return <td className="px-2 py-1 text-slate-300 border border-[#334155]">{children}</td> },
}

function ModelColumnView({ column, onHide }: { column: ModelColumn; onHide: () => void }) {
  const { getModel } = useModelStore()
  const model = getModel(column.modelId)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [column.messages])

  if (column.hidden) return null

  return (
    <div className="flex flex-col flex-1 min-w-0 border-r border-[#334155] last:border-r-0">
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#1e293b] border-b border-[#334155]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-sm font-medium text-white">{model?.name ?? column.modelId}</span>
          {column.streaming && (
            <span className="text-xs text-blue-400 flex items-center gap-1">
              <span className="w-1 h-1 bg-blue-400 rounded-full animate-pulse" />
              Streaming
            </span>
          )}
        </div>
        <button
          onClick={onHide}
          className="text-slate-500 hover:text-white transition-colors"
          title="Hide column"
        >
          <EyeOff size={14} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {column.messages.map(msg => (
          <div key={msg.id} className={`${msg.role === 'user' ? 'text-right' : ''}`}>
            {msg.role === 'assistant' ? (
              <div className="bg-[#1e293b] rounded-xl px-4 py-3 text-sm text-[#cbd5e1] leading-relaxed">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={panelComponents}
                >
                  {msg.content}
                </ReactMarkdown>
                {msg.isStreaming && (
                  <span className="inline-block w-1 h-4 bg-blue-400 animate-pulse ml-0.5 align-text-bottom" />
                )}
              </div>
            ) : (
              <div className="inline-block bg-blue-600 text-white rounded-xl px-4 py-3 text-sm max-w-xs">
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            )}
          </div>
        ))}
        {column.streaming && column.messages.length > 0 && !column.messages[column.messages.length - 1]?.content && (
          <div className="flex gap-1 items-center py-1">
            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

    </div>
  )
}

export function MultiModelPanel({ columns, onHideColumn, onShowColumn }: MultiModelPanelProps) {
  const { getModel } = useModelStore()
  const hiddenColumns = columns.filter(c => c.hidden)

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Hidden model pills */}
      {hiddenColumns.length > 0 && (
        <div className="flex gap-2 px-4 py-2 border-b border-[#334155]">
          {hiddenColumns.map(col => (
            <button
              key={col.modelId}
              onClick={() => onShowColumn(col.modelId)}
              className="text-xs text-slate-400 hover:text-white bg-[#1e293b] hover:bg-[#334155] px-3 py-1 rounded-full transition-colors flex items-center gap-1"
            >
              <X size={10} />
              {getModel(col.modelId)?.name ?? col.modelId}
            </button>
          ))}
        </div>
      )}

      {/* Columns */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {columns.map(col => (
          <ModelColumnView
            key={col.modelId}
            column={col}
            onHide={() => onHideColumn(col.modelId)}
          />
        ))}
      </div>
    </div>
  )
}
