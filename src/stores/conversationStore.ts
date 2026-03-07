import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { Conversation, Message, ConversationMode } from '../types'
import {
  loadConversations, saveConversation, deleteConversation as dbDeleteConversation,
  loadMessages, saveMessage, deleteMessages
} from '../lib/db'
import { logInfo } from '../lib/logger'

interface ConversationStore {
  conversations: Conversation[]
  activeConversationId: string | null
  messages: Record<string, Message>  // messageId -> Message
  loaded: boolean

  // Loading
  load: () => Promise<void>
  loadConversationMessages: (conversationId: string) => Promise<void>

  // Conversations
  createConversation: (opts: {
    title?: string
    mode?: ConversationMode
    models?: string[]
  }) => Promise<Conversation>
  updateConversation: (id: string, data: Partial<Conversation>) => Promise<void>
  deleteConversation: (id: string) => Promise<void>
  setActive: (id: string | null) => void

  // Messages
  addMessage: (msg: Omit<Message, 'children' | 'createdAt'> & { children?: string[] }) => Promise<Message>
  updateMessage: (id: string, data: Partial<Message>) => Promise<void>
  appendContent: (id: string, chunk: string) => void

  // Branching
  forkFrom: (messageId: string) => string | null
  setActivePath: (conversationId: string, pathIds: string[]) => Promise<void>

  // Computed
  getActivePath: () => Message[]
  getConversation: () => Conversation | null
  getMessageMap: () => Record<string, Message>
}

export const useConversationStore = create<ConversationStore>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},
  loaded: false,

  load: async () => {
    const conversations = await loadConversations()
    set({ conversations, loaded: true })
  },

  loadConversationMessages: async (conversationId: string) => {
    const msgs = await loadMessages(conversationId)
    const msgMap: Record<string, Message> = {}
    for (const m of msgs) msgMap[m.id] = m
    set(s => ({ messages: { ...s.messages, ...msgMap } }))
  },

  createConversation: async ({ title = 'New Conversation', mode = 'single', models = [] }) => {
    const conv: Conversation = {
      id: uuidv4(),
      title,
      mode,
      models,
      rootMessageId: null,
      activePathIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await saveConversation(conv)
    set(s => ({ conversations: [conv, ...s.conversations], activeConversationId: conv.id }))
    logInfo(`[conversation] 创建: "${title}" mode=${mode} models=${models.length}`)
    return conv
  },

  updateConversation: async (id, data) => {
    const conv = get().conversations.find(c => c.id === id)
    if (!conv) return
    const updated = { ...conv, ...data, updatedAt: Date.now() }
    await saveConversation(updated)
    set(s => ({ conversations: s.conversations.map(c => c.id === id ? updated : c) }))
  },

  deleteConversation: async (id) => {
    const title = get().conversations.find(c => c.id === id)?.title ?? id
    logInfo(`[conversation] 删除: "${title}"`)
    await dbDeleteConversation(id)
    await deleteMessages(id)
    set(s => {
      const conversations = s.conversations.filter(c => c.id !== id)
      // Remove messages for this conversation
      const messages = { ...s.messages }
      Object.keys(messages).forEach(k => {
        if (messages[k].conversationId === id) delete messages[k]
      })
      return {
        conversations,
        messages,
        activeConversationId: s.activeConversationId === id
          ? (conversations[0]?.id ?? null)
          : s.activeConversationId
      }
    })
  },

  setActive: (id) => {
    set({ activeConversationId: id })
  },

  addMessage: async (msgData) => {
    const msg: Message = {
      ...msgData,
      children: msgData.children ?? [],
      createdAt: Date.now(),
    }
    await saveMessage(msg)

    set(s => {
      const messages = { ...s.messages, [msg.id]: msg }

      // Update parent's children array
      if (msg.parentId && messages[msg.parentId]) {
        const parent = { ...messages[msg.parentId] }
        if (!parent.children.includes(msg.id)) {
          parent.children = [...parent.children, msg.id]
          messages[msg.parentId] = parent
          // Save parent update in background
          saveMessage(parent).catch(console.error)
        }
      }

      // Update conversation: set rootMessageId if first message, update activePath
      const convId = msg.conversationId
      const conversations = s.conversations.map(c => {
        if (c.id !== convId) return c
        let rootMessageId = c.rootMessageId
        let activePathIds = [...c.activePathIds]

        if (!rootMessageId && !msg.parentId) {
          rootMessageId = msg.id
        }
        if (!activePathIds.includes(msg.id)) {
          activePathIds = [...activePathIds, msg.id]
        }
        return { ...c, rootMessageId, activePathIds, updatedAt: Date.now() }
      })

      const updatedConv = conversations.find(c => c.id === msg.conversationId)
      if (updatedConv) saveConversation(updatedConv).catch(console.error)

      return { messages, conversations }
    })

    return msg
  },

  updateMessage: async (id, data) => {
    const msg = get().messages[id]
    if (!msg) return
    const updated = { ...msg, ...data }
    await saveMessage(updated)
    set(s => ({ messages: { ...s.messages, [id]: updated } }))
  },

  appendContent: (id, chunk) => {
    set(s => {
      const msg = s.messages[id]
      if (!msg) return s
      return { messages: { ...s.messages, [id]: { ...msg, content: msg.content + chunk } } }
    })
  },

  forkFrom: (messageId: string) => {
    const state = get()
    const conv = state.conversations.find(c => c.id === state.activeConversationId)
    if (!conv) return null

    // Build new active path: path up to and including the forked message
    const msg = state.messages[messageId]
    if (!msg) return null

    // Reconstruct path from root to this message
    const path: string[] = []
    let current: Message | undefined = msg
    while (current) {
      path.unshift(current.id)
      current = current.parentId ? state.messages[current.parentId] : undefined
    }

    // Update active path to this fork point
    const updated = { ...conv, activePathIds: path, updatedAt: Date.now() }
    saveConversation(updated).catch(console.error)
    set(s => ({ conversations: s.conversations.map(c => c.id === conv.id ? updated : c) }))

    return messageId
  },

  setActivePath: async (conversationId, pathIds) => {
    const { conversations } = get()
    const conv = conversations.find(c => c.id === conversationId)
    if (!conv) return
    const updated = { ...conv, activePathIds: pathIds, updatedAt: Date.now() }
    await saveConversation(updated)
    set(s => ({ conversations: s.conversations.map(c => c.id === conversationId ? updated : c) }))
  },

  getActivePath: () => {
    const { activeConversationId, conversations, messages } = get()
    const conv = conversations.find(c => c.id === activeConversationId)
    if (!conv) return []
    return conv.activePathIds.map(id => messages[id]).filter(Boolean)
  },

  getConversation: () => {
    const { activeConversationId, conversations } = get()
    return conversations.find(c => c.id === activeConversationId) ?? null
  },

  getMessageMap: () => get().messages,
}))
