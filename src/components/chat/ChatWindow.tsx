import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Square, Paperclip, X, FileText } from 'lucide-react'
import { useConversationStore } from '../../stores/conversationStore'
import { useModelStore } from '../../stores/modelStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { MessageBubble } from './MessageBubble'
import { MultiModelPanel } from './MultiModelPanel'
import { streamChat, generateTitle } from '../../lib/api'
import type { ChatMessage, ContentPart } from '../../lib/api'
import type { Message, Attachment } from '../../types'
import { logError, logInfo } from '../../lib/logger'
import { v4 as uuidv4 } from 'uuid'

interface ColumnState {
  modelId: string
  streamingMsgId: string | null
  hidden: boolean
  abortController: AbortController | null
}

// Read a File as base64 dataURL (for images) or text (for text files)
function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

// Build ChatMessage content with attachments (Vision API format)
function buildMessageContent(text: string, attachments: Attachment[]): string | ContentPart[] {
  if (attachments.length === 0) return text

  const parts: ContentPart[] = []

  // Add image attachments first
  for (const att of attachments) {
    if (att.type === 'image') {
      parts.push({ type: 'image_url', image_url: { url: att.data } })
    }
  }

  // Build text content: user text + file contents appended
  let textContent = text
  for (const att of attachments) {
    if (att.type === 'file') {
      textContent += `\n\n[文件: ${att.name}]\n${att.data}`
    }
  }
  if (textContent) {
    parts.push({ type: 'text', text: textContent })
  }

  return parts.length === 1 && parts[0].type === 'text' ? (parts[0] as { type: 'text'; text: string }).text : parts
}

export function ChatWindow() {
  const {
    getConversation, getActivePath, getMessageMap,
    addMessage, appendContent, updateMessage, updateConversation, setActivePath,
    activeConversationId, forkFrom, messages
  } = useConversationStore()

  const { models, defaultModelId, getModel } = useModelStore()
  const { globalSystemPrompt } = useSettingsStore()

  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [columnStates, setColumnStates] = useState<ColumnState[]>([])
  const [roundRobinTurn, setRoundRobinTurn] = useState(0)
  const [roundRobinActive, setRoundRobinActive] = useState(false)
  const [roundRobinCount, setRoundRobinCount] = useState(0)
  const [attachments, setAttachments] = useState<Attachment[]>([])

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const prevConvIdRef = useRef<string | null>(null)
  const prevPathLenRef = useRef<number>(0)

  const conv = getConversation()
  const activePath = getActivePath()
  const messageMap = getMessageMap()

  useEffect(() => {
    const convChanged = activeConversationId !== prevConvIdRef.current
    const newMessage = !convChanged && activePath.length > prevPathLenRef.current

    prevConvIdRef.current = activeConversationId ?? null
    prevPathLenRef.current = activePath.length

    // Only scroll to bottom when a new message arrives or streaming updates,
    // not when switching conversations (which should keep the scroll position).
    if (newMessage || (isStreaming && !convChanged)) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [activeConversationId, activePath.length, isStreaming])

  useEffect(() => {
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = 'auto'
      ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'
    }
  }, [input])

  useEffect(() => {
    if (!conv) { setColumnStates([]); return }
    if (conv.mode === 'multi-parallel' || conv.mode === 'multi-roundrobin') {
      setColumnStates(conv.models.map(modelId => ({
        modelId, streamingMsgId: null, lastAssistantMsgId: null, hidden: false, abortController: null,
      })))
    } else {
      setColumnStates([])
    }
    setRoundRobinTurn(0)
    setRoundRobinActive(false)
    setRoundRobinCount(0)
  }, [conv?.id, conv?.mode])

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    columnStates.forEach(cs => cs.abortController?.abort())
    setIsStreaming(false)
    setRoundRobinActive(false)
    setColumnStates(cs => cs.map(c => ({ ...c, abortController: null, streamingMsgId: null })))
  }, [columnStates])

  // Build system message array (global fallback → per-conv override)
  const buildSystemMessages = useCallback((): ChatMessage[] => {
    const prompt = conv?.systemPrompt ?? globalSystemPrompt
    if (!prompt.trim()) return []
    return [{ role: 'system', content: prompt.trim() }]
  }, [conv, globalSystemPrompt])

  // Handle file selection
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    const newAttachments: Attachment[] = []
    for (const file of files) {
      try {
        if (file.type.startsWith('image/')) {
          const data = await readFileAsDataURL(file)
          newAttachments.push({ type: 'image', name: file.name, mimeType: file.type, data })
        } else {
          const data = await readFileAsText(file)
          newAttachments.push({ type: 'file', name: file.name, mimeType: file.type || 'text/plain', data })
        }
      } catch (err) {
        logError(`[ChatWindow] 读取文件失败: ${file.name} — ${(err as Error).message}`)
      }
    }
    setAttachments(prev => [...prev, ...newAttachments])
    // Reset file input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const removeAttachment = useCallback((idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx))
  }, [])

  // ── Single model ──────────────────────────────────────────────────
  const sendSingle = useCallback(async (userContent: string, atts: Attachment[]) => {
    if (!conv || !activeConversationId) return
    const modelId = conv.models[0] ?? defaultModelId
    if (!modelId) return
    const model = getModel(modelId)
    if (!model) return

    const isFirstMessage = activePath.length === 0

    const lastMsg = activePath[activePath.length - 1]
    const userMsg = await addMessage({
      id: uuidv4(), conversationId: activeConversationId,
      parentId: lastMsg?.id ?? null, role: 'user', content: userContent,
      attachments: atts.length > 0 ? atts : undefined,
    })
    const assistantMsg = await addMessage({
      id: uuidv4(), conversationId: activeConversationId,
      parentId: userMsg.id, role: 'assistant', modelId, content: '', isStreaming: true,
    })

    const abort = new AbortController()
    abortRef.current = abort
    setIsStreaming(true)

    const chatMessages: ChatMessage[] = [
      ...buildSystemMessages(),
      ...[...activePath, userMsg].map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.role === 'user'
          ? buildMessageContent(m.content, m.attachments ?? [])
          : m.content,
      })),
    ]

    await streamChat(model, chatMessages, {
      onChunk: (chunk) => appendContent(assistantMsg.id, chunk),
      onDone: () => {
        updateMessage(assistantMsg.id, { isStreaming: false })
        setIsStreaming(false)
        abortRef.current = null
        // Auto-generate title after first exchange
        if (isFirstMessage && conv.title === 'New Conversation') {
          const finalContent = useConversationStore.getState().messages[assistantMsg.id]?.content ?? ''
          const titleModel = getModel(defaultModelId ?? modelId) ?? model
          generateTitle(titleModel, userContent, finalContent).then(title => {
            if (title) updateConversation(activeConversationId, { title })
          })
        }
      },
      onError: (err) => { updateMessage(assistantMsg.id, { content: `Error: ${err}`, isStreaming: false }); setIsStreaming(false); abortRef.current = null },
    }, abort.signal)
  }, [conv, activePath, activeConversationId, defaultModelId, getModel, addMessage, appendContent, updateMessage, updateConversation, buildSystemMessages])

  // ── Multi-parallel ────────────────────────────────────────────────
  const sendParallel = useCallback(async (userContent: string, atts: Attachment[]) => {
    if (!conv || !activeConversationId) return
    const lastMsg = activePath[activePath.length - 1]
    const userMsg = await addMessage({
      id: uuidv4(), conversationId: activeConversationId,
      parentId: lastMsg?.id ?? null, role: 'user', content: userContent,
      attachments: atts.length > 0 ? atts : undefined,
    })

    setIsStreaming(true)

    const assistantMsgIds: Record<string, string> = {}
    for (const modelId of conv.models) {
      const assistantMsg = await addMessage({
        id: uuidv4(), conversationId: activeConversationId,
        parentId: userMsg.id, role: 'assistant', modelId, content: '', isStreaming: true,
      })
      assistantMsgIds[modelId] = assistantMsg.id
    }

    const chatMessages: ChatMessage[] = [
      ...buildSystemMessages(),
      ...[...activePath, userMsg].map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.role === 'user'
          ? buildMessageContent(m.content, m.attachments ?? [])
          : m.content,
      })),
    ]

    const newControllers: Record<string, AbortController> = {}
    const newColumnStates = conv.models.map(modelId => {
      const abort = new AbortController()
      newControllers[modelId] = abort
      return {
        modelId, streamingMsgId: assistantMsgIds[modelId],
        hidden: false, abortController: abort,
      }
    })
    setColumnStates(newColumnStates)

    let completedCount = 0
    const total = conv.models.length

    conv.models.forEach(modelId => {
      const model = getModel(modelId)
      const msgId = assistantMsgIds[modelId]
      const done = () => {
        completedCount++
        if (completedCount === total) {
          setIsStreaming(false)
          setColumnStates(cs => cs.map(c => ({ ...c, streamingMsgId: null })))
        }
      }
      if (!model) { done(); return }

      streamChat(model, chatMessages, {
        onChunk: (chunk) => appendContent(msgId, chunk),
        onDone: () => { updateMessage(msgId, { isStreaming: false }); done() },
        onError: (err) => { updateMessage(msgId, { content: `Error: ${err}`, isStreaming: false }); done() },
      }, newControllers[modelId].signal)
    })
  }, [conv, activePath, activeConversationId, getModel, addMessage, appendContent, updateMessage, buildSystemMessages])

  // ── Round-robin: infinite until stopped ──────────────────────────
  const sendRoundRobin = useCallback(async (userContent: string, atts: Attachment[]) => {
    if (!conv || !activeConversationId || conv.models.length === 0) return
    const lastMsg = activePath[activePath.length - 1]
    const userMsg = await addMessage({
      id: uuidv4(), conversationId: activeConversationId,
      parentId: lastMsg?.id ?? null, role: 'user', content: userContent,
      attachments: atts.length > 0 ? atts : undefined,
    })

    setIsStreaming(true)
    setRoundRobinActive(true)
    setRoundRobinCount(0)

    const abort = new AbortController()
    abortRef.current = abort

    // Conversation context grows with each turn — start with history + user message
    let context: Message[] = [...activePath, userMsg]
    let parentMsgId = userMsg.id
    let turn = 0

    while (!abort.signal.aborted) {
      const modelIdx = turn % conv.models.length
      const modelId = conv.models[modelIdx]
      const model = getModel(modelId)
      setRoundRobinTurn(modelIdx)

      if (!model) { turn++; continue }

      const assistantMsg = await addMessage({
        id: uuidv4(), conversationId: activeConversationId,
        parentId: parentMsgId, role: 'assistant', modelId, content: '', isStreaming: true,
      })

      // Per-model instruction takes priority over per-conv → global
      const perModelPrompt = conv.modelInstructions?.[modelId]
      const systemPrompt = perModelPrompt ?? conv.systemPrompt ?? globalSystemPrompt
      const sysMessages: ChatMessage[] = systemPrompt?.trim()
        ? [{ role: 'system', content: systemPrompt.trim() }]
        : []

      const chatMessages: ChatMessage[] = [
        ...sysMessages,
        ...context.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.role === 'user'
            ? buildMessageContent(m.content, m.attachments ?? [])
            : m.content,
        })),
      ]
      // Some models (e.g. Claude) require the last message to be from 'user'.
      if (chatMessages.at(-1)?.role === 'assistant') {
        const modelName = model.name ?? modelId
        chatMessages.push({ role: 'user', content: `请作为 ${modelName} 继续发表你的观点。` })
      }

      await new Promise<void>((resolve) => {
        streamChat(model, chatMessages, {
          onChunk: (chunk) => appendContent(assistantMsg.id, chunk),
          onDone: () => { updateMessage(assistantMsg.id, { isStreaming: false }); resolve() },
          onError: (err) => { updateMessage(assistantMsg.id, { content: `Error: ${err}`, isStreaming: false }); resolve() },
        }, abort.signal)
      })

      if (abort.signal.aborted) break

      // Add this response to growing context for next model to see
      const updatedMsg = useConversationStore.getState().messages[assistantMsg.id]
      if (updatedMsg) context = [...context, updatedMsg]
      parentMsgId = assistantMsg.id
      turn++
      setRoundRobinCount(turn)
    }

    setIsStreaming(false)
    setRoundRobinActive(false)
    setRoundRobinTurn(0)
  }, [conv, activePath, activeConversationId, getModel, addMessage, appendContent, updateMessage, buildSystemMessages])

  const handleSend = async () => {
    const content = input.trim()
    if ((!content && attachments.length === 0) || isStreaming || !conv) return
    const atts = attachments
    setInput('')
    setAttachments([])
    logInfo(`[send] mode=${conv.mode} attachments=${atts.length} text="${content.slice(0, 50)}${content.length > 50 ? '…' : ''}"`)


    if (conv.mode === 'multi-parallel') {
      await sendParallel(content, atts)
    } else if (conv.mode === 'multi-roundrobin') {
      await sendRoundRobin(content, atts)
    } else {
      await sendSingle(content, atts)
    }
  }

  const handleFork = useCallback(async (messageId: string) => {
    forkFrom(messageId)
    setTimeout(() => textareaRef.current?.focus(), 100)
  }, [forkFrom])

  const handleSwitchBranch = useCallback((targetId: string) => {
    if (!activeConversationId) return
    const msg = messageMap[targetId]
    if (!msg) return

    let leafId = targetId
    while (messageMap[leafId]?.children.length > 0) {
      leafId = messageMap[leafId].children[0]
    }
    const path: string[] = []
    let current: Message | undefined = messageMap[leafId]
    while (current) {
      path.unshift(current.id)
      current = current.parentId ? messageMap[current.parentId] : undefined
    }
    setActivePath(activeConversationId, path)
  }, [activeConversationId, messageMap, setActivePath])

  if (!conv) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        <div className="text-center">
          <p className="text-lg mb-2">No conversation selected</p>
          <p className="text-sm">Create a new conversation to get started</p>
        </div>
      </div>
    )
  }

  // Build column data for multi-parallel
  const buildColumns = () => {
    if (conv.mode !== 'multi-parallel') return []
    return columnStates.map(cs => {
      const colMessages = activePath.filter(m => m.role === 'user' || m.modelId === cs.modelId)
      if (cs.streamingMsgId && messages[cs.streamingMsgId]) {
        if (!colMessages.find(m => m.id === cs.streamingMsgId)) colMessages.push(messages[cs.streamingMsgId])
      }
      return {
        modelId: cs.modelId,
        messages: colMessages,
        streaming: !!cs.streamingMsgId,
        hidden: cs.hidden,
      }
    })
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Round-robin status bar */}
      {conv.mode === 'multi-roundrobin' && roundRobinActive && (
        <div className="bg-[#1e293b] border-b border-[#334155] px-4 py-2 flex items-center gap-3 text-sm">
          <div className="flex items-center gap-2">
            {conv.models.map((modelId, i) => {
              const model = getModel(modelId)
              return (
                <div key={modelId} className={`px-3 py-1 rounded-full text-xs transition-all ${
                  i === roundRobinTurn ? 'bg-blue-600 text-white scale-105' : 'bg-[#334155] text-slate-400'
                }`}>
                  {model?.name ?? modelId}
                </div>
              )
            })}
          </div>
          <span className="text-slate-500 text-xs ml-auto">第 {roundRobinCount + 1} 轮</span>
        </div>
      )}

      {/* Chat area */}
      {conv.mode === 'multi-parallel' ? (
        <MultiModelPanel
          columns={buildColumns()}
          onHideColumn={(modelId) => setColumnStates(cs => cs.map(c => c.modelId === modelId ? { ...c, hidden: true } : c))}
          onShowColumn={(modelId) => setColumnStates(cs => cs.map(c => c.modelId === modelId ? { ...c, hidden: false } : c))}
        />
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto">
            {activePath.length === 0 ? (
              <div className="text-center text-slate-500 mt-20">
                <p className="text-lg mb-1">Start a conversation</p>
                <p className="text-sm">
                  {conv.mode === 'single'
                    ? `Using ${getModel(conv.models[0] ?? defaultModelId ?? '')?.name ?? 'no model selected'}`
                    : `${conv.models.length} models · ${conv.mode === 'multi-roundrobin' ? '模型互相对话，按 Stop 结束' : conv.mode}`
                  }
                </p>
                {models.length === 0 && <p className="text-sm text-yellow-400 mt-4">Add a model in Settings to get started</p>}
              </div>
            ) : (
              activePath.map((msg) => {
                const parent = msg.parentId ? messageMap[msg.parentId] : null
                const siblings = parent?.children ?? (conv.rootMessageId ? [conv.rootMessageId] : [])
                const siblingIndex = siblings.indexOf(msg.id)
                return (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    onFork={handleFork}
                    siblings={siblings.length > 1 ? siblings : undefined}
                    activeSiblingIndex={siblings.length > 1 ? siblingIndex : undefined}
                    onSwitchBranch={siblings.length > 1 ? (sibId) => handleSwitchBranch(sibId) : undefined}
                  />
                )
              })
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      )}

      {/* Attachment preview strip */}
      {attachments.length > 0 && (
        <div className="border-t border-[#334155] px-4 pt-3 pb-0">
          <div className="max-w-3xl mx-auto flex gap-2 flex-wrap">
            {attachments.map((att, idx) => (
              <div key={idx} className="relative group flex items-center gap-1.5 bg-[#1e293b] border border-[#334155] rounded-lg px-2 py-1.5 text-xs text-slate-300">
                {att.type === 'image' ? (
                  <img src={att.data} alt={att.name} className="h-10 w-10 object-cover rounded" />
                ) : (
                  <FileText size={16} className="text-slate-400 flex-shrink-0" />
                )}
                <span className="max-w-[120px] truncate">{att.name}</span>
                <button
                  onClick={() => removeAttachment(idx)}
                  className="ml-1 text-slate-500 hover:text-red-400 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-[#334155] p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-3 items-end">
            {/* File attach button */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,text/*,.md,.json,.csv,.xml,.yaml,.yml,.toml,.log,.sh,.py,.js,.ts,.jsx,.tsx,.rs,.go,.java,.c,.cpp,.h"
              className="hidden"
              onChange={handleFileSelect}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming}
              title="上传图片或文件"
              className="text-slate-500 hover:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed p-3 rounded-xl hover:bg-[#1e293b] transition-colors flex-shrink-0"
            >
              <Paperclip size={18} />
            </button>

            <div className="flex-1">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                placeholder={
                  isStreaming
                    ? conv.mode === 'multi-roundrobin' ? '模型对话中... (点击 Stop 结束)' : 'Waiting for response...'
                    : 'Type a message... (Enter to send, Shift+Enter for newline)'
                }
                disabled={isStreaming}
                rows={1}
                className="w-full bg-[#1e293b] border border-[#334155] rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none transition-colors disabled:opacity-50"
                style={{ minHeight: '48px', maxHeight: '200px' }}
              />
            </div>
            {isStreaming ? (
              <button onClick={stopStreaming} className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-xl transition-colors flex-shrink-0" title="Stop">
                <Square size={18} />
              </button>
            ) : (
              <button onClick={handleSend} disabled={(!input.trim() && attachments.length === 0) || !conv || models.length === 0}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white p-3 rounded-xl transition-colors flex-shrink-0" title="Send (Enter)">
                <Send size={18} />
              </button>
            )}
          </div>
          <div className="mt-2 px-1">
            <span className="text-xs text-slate-600">
              {conv.mode === 'single'
                ? getModel(conv.models[0] ?? defaultModelId ?? '')?.name ?? 'No model'
                : conv.models.map(id => getModel(id)?.name ?? id).join(' • ')
              }
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
