import { useState, useCallback, isValidElement } from 'react'
import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import { GitBranch, Copy, Check, ChevronLeft, ChevronRight, AlertTriangle, ChevronDown, ChevronUp, FileText, X } from 'lucide-react'
import type { Components } from 'react-markdown'
import type { Message, Attachment } from '../../types'
import { useModelStore } from '../../stores/modelStore'

interface MessageBubbleProps {
  message: Message
  onFork?: (messageId: string) => void
  siblings?: string[]
  activeSiblingIndex?: number
  onSwitchBranch?: (siblingId: string) => void
}

function isErrorContent(content: string) {
  return content.startsWith('Error:') || content.startsWith('HTTP ') || content.startsWith('网络连接失败')
}

const COLLAPSE_THRESHOLD = 4

function ErrorBubble({ content }: { content: string }) {
  const lines = content.split('\n').filter(Boolean)
  const canCollapse = lines.length > COLLAPSE_THRESHOLD
  const [collapsed, setCollapsed] = useState(false)
  const visibleLines = collapsed ? lines.slice(0, COLLAPSE_THRESHOLD) : lines

  return (
    <div className="bg-red-950/60 border border-red-700/60 rounded-xl px-4 py-3 text-sm max-w-xl">
      <div className="flex items-start gap-2">
        <AlertTriangle size={15} className="text-red-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-red-300 font-medium break-all">{lines[0]}</p>
          {lines.length > 1 && (
            <div className="mt-2 space-y-1 border-t border-red-800/50 pt-2">
              {visibleLines.slice(1).map((line, i) => (
                <p key={i} className="text-xs text-red-400 break-all font-mono">{line}</p>
              ))}
              {canCollapse && (
                <button
                  onClick={() => setCollapsed(c => !c)}
                  className="flex items-center gap-1 text-xs text-red-600 hover:text-red-300 mt-1 transition-colors"
                >
                  {collapsed ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
                  {collapsed ? `展开全部 (${lines.length} 行)` : '收起'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Extract plain text from React nodes (for copy button)
function extractText(node: ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (!node) return ''
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (isValidElement(node)) return extractText((node.props as { children?: ReactNode }).children)
  return ''
}

// Code block with language label + copy button
// children: already-highlighted React nodes from rehype-highlight
function CodeBlock({ language, children }: { language: string; children: ReactNode }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(extractText(children).replace(/\n$/, ''))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="my-3 rounded-xl overflow-hidden border border-[#2d3f55]">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-[#0d1b2a] border-b border-[#2d3f55]">
        <span className="text-xs text-slate-400 font-mono">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors py-0.5 px-2 rounded hover:bg-[#1e293b]"
        >
          {copied ? <><Check size={12} />Copied</> : <><Copy size={12} />Copy</>}
        </button>
      </div>
      {/* Code body — render highlighted children directly */}
      <pre className="overflow-x-auto p-4 bg-[#0f1923] text-sm leading-relaxed m-0">
        <code className={language ? `language-${language}` : ''}>{children}</code>
      </pre>
    </div>
  )
}

// Custom markdown components for dark theme
function useMarkdownComponents(): Components {
  return {
    // Intercept code: fenced blocks have className like "language-xxx"
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className ?? '')
      // isBlock: has language tag OR plain string with newline (unfenced multiline)
      const isBlock = !!match || (typeof children === 'string' && children.includes('\n'))
      if (isBlock) {
        // Pass children directly — rehype-highlight has already turned them into highlighted nodes
        return <CodeBlock language={match?.[1] ?? ''}>{children}</CodeBlock>
      }
      // Inline code
      return (
        <code
          className="bg-[#1e2d3d] text-[#7dd3fc] px-1.5 py-0.5 rounded text-[0.85em] font-mono"
          {...props}
        >
          {children}
        </code>
      )
    },
    // Wrap pre to avoid double-wrapping with CodeBlock
    pre({ children }) {
      return <>{children}</>
    },
    p({ children }) {
      return <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>
    },
    h1({ children }) {
      return <h1 className="text-xl font-bold mt-5 mb-2 text-white">{children}</h1>
    },
    h2({ children }) {
      return <h2 className="text-lg font-bold mt-4 mb-2 text-white">{children}</h2>
    },
    h3({ children }) {
      return <h3 className="text-base font-semibold mt-3 mb-1.5 text-white">{children}</h3>
    },
    ul({ children }) {
      return <ul className="list-disc list-outside ml-5 mb-3 space-y-1">{children}</ul>
    },
    ol({ children }) {
      return <ol className="list-decimal list-outside ml-5 mb-3 space-y-1">{children}</ol>
    },
    li({ children }) {
      return <li className="leading-relaxed">{children}</li>
    },
    blockquote({ children }) {
      return (
        <blockquote className="border-l-2 border-slate-500 pl-4 my-3 text-slate-400 italic">
          {children}
        </blockquote>
      )
    },
    a({ href, children }) {
      return (
        <a href={href} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 underline">
          {children}
        </a>
      )
    },
    table({ children }) {
      return (
        <div className="overflow-x-auto my-3">
          <table className="w-full text-sm border-collapse">{children}</table>
        </div>
      )
    },
    thead({ children }) {
      return <thead className="bg-[#1e293b]">{children}</thead>
    },
    th({ children }) {
      return <th className="px-3 py-2 text-left text-slate-300 font-medium border border-[#334155]">{children}</th>
    },
    td({ children }) {
      return <td className="px-3 py-2 text-slate-300 border border-[#334155]">{children}</td>
    },
    hr() {
      return <hr className="border-[#334155] my-4" />
    },
    strong({ children }) {
      return <strong className="font-semibold text-white">{children}</strong>
    },
  }
}

// Image lightbox state (simple inline expand)
function AttachmentPreview({ attachments }: { attachments: Attachment[] }) {
  const [lightbox, setLightbox] = useState<string | null>(null)

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-2">
        {attachments.map((att, idx) => (
          att.type === 'image' ? (
            <img
              key={idx}
              src={att.data}
              alt={att.name}
              title={att.name}
              onClick={() => setLightbox(att.data)}
              className="max-h-48 max-w-xs rounded-lg border border-white/10 cursor-pointer hover:opacity-90 transition-opacity object-cover"
            />
          ) : (
            <div key={idx} className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-300">
              <FileText size={13} className="flex-shrink-0" />
              <span className="max-w-[160px] truncate">{att.name}</span>
            </div>
          )
        ))}
      </div>
      {/* Lightbox overlay */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/40 rounded-full p-1.5"
            onClick={() => setLightbox(null)}
          >
            <X size={20} />
          </button>
          <img
            src={lightbox}
            alt="preview"
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}

function MarkdownContent({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  const components = useMarkdownComponents()
  return (
    <div className="text-sm text-[#cbd5e1] leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {content}
      </ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-1 h-4 bg-blue-400 animate-pulse ml-0.5 align-text-bottom" />
      )}
    </div>
  )
}

export function MessageBubble({ message, onFork, siblings, activeSiblingIndex, onSwitchBranch }: MessageBubbleProps) {
  const [hovered, setHovered] = useState(false)
  const [copied, setCopied] = useState(false)
  const { getModel } = useModelStore()

  const model = message.modelId ? getModel(message.modelId) : null
  const isUser = message.role === 'user'
  const hasBranches = siblings && siblings.length > 1
  const isError = !isUser && isErrorContent(message.content)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [message.content])

  return (
    <div
      className={`group flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[80%]`}>
        {/* Model label */}
        {!isUser && model && (
          <div className="text-xs text-slate-500 mb-1 ml-1">{model.name}</div>
        )}

        <div className="flex items-end gap-2">
          {/* Action buttons — left side for assistant */}
          {!isUser && (
            <div className={`flex flex-col gap-1 mb-1 transition-opacity ${hovered ? 'opacity-100' : 'opacity-0'}`}>
              <button
                onClick={handleCopy}
                title="Copy"
                className="p-1 rounded text-slate-500 hover:text-white hover:bg-[#334155] transition-colors"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </button>
              {onFork && !isError && (
                <button
                  onClick={() => onFork(message.id)}
                  title="Fork conversation from here"
                  className="p-1 rounded text-slate-500 hover:text-blue-400 hover:bg-[#334155] transition-colors"
                >
                  <GitBranch size={13} />
                </button>
              )}
            </div>
          )}

          {/* Message bubble */}
          {isError ? (
            <ErrorBubble content={message.content} />
          ) : (
            <div className={`rounded-2xl px-4 py-3 ${
              isUser
                ? 'bg-blue-600 text-white rounded-br-sm'
                : 'bg-[#1e293b] text-[#e2e8f0] rounded-bl-sm'
            }`}>
              {message.isStreaming && !message.content ? (
                <div className="flex gap-1 items-center py-1">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              ) : isUser ? (
                <>
                  {message.attachments && message.attachments.length > 0 && (
                    <AttachmentPreview attachments={message.attachments} />
                  )}
                  {message.content && <p className="text-sm whitespace-pre-wrap">{message.content}</p>}
                </>
              ) : (
                <MarkdownContent content={message.content} isStreaming={message.isStreaming} />
              )}
            </div>
          )}

          {/* Action buttons — right side for user */}
          {isUser && (
            <div className={`flex flex-col gap-1 mb-1 transition-opacity ${hovered ? 'opacity-100' : 'opacity-0'}`}>
              <button
                onClick={handleCopy}
                title="Copy"
                className="p-1 rounded text-slate-500 hover:text-white hover:bg-[#334155] transition-colors"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </button>
              {onFork && (
                <button
                  onClick={() => onFork(message.id)}
                  title="Fork conversation from here"
                  className="p-1 rounded text-slate-500 hover:text-blue-400 hover:bg-[#334155] transition-colors"
                >
                  <GitBranch size={13} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Branch navigation */}
        {hasBranches && onSwitchBranch && (
          <div className={`flex items-center gap-1 mt-1 text-xs text-slate-500 ${isUser ? 'mr-1' : 'ml-1'}`}>
            <button
              onClick={() => {
                const prev = activeSiblingIndex! - 1
                if (prev >= 0) onSwitchBranch(siblings[prev])
              }}
              disabled={activeSiblingIndex === 0}
              className="p-0.5 rounded hover:bg-[#334155] disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={12} />
            </button>
            <span>{(activeSiblingIndex ?? 0) + 1} / {siblings.length}</span>
            <button
              onClick={() => {
                const next = activeSiblingIndex! + 1
                if (next < siblings.length) onSwitchBranch(siblings[next])
              }}
              disabled={activeSiblingIndex === siblings.length - 1}
              className="p-0.5 rounded hover:bg-[#334155] disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
