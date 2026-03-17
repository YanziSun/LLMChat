// Database abstraction - wraps tauri-plugin-sql when in Tauri, falls back to localStorage
import type { ModelConfig, Conversation, Message } from '../types'

// Check if running in Tauri
const isTauri = () => typeof window !== 'undefined' && '__TAURI__' in window

// Dynamic import for Tauri SQL plugin
let dbInstance: any = null

async function getDb() {
  if (!isTauri()) return null
  if (dbInstance) return dbInstance
  try {
    const { default: Database } = await import('@tauri-apps/plugin-sql')
    dbInstance = await Database.load('sqlite:llmchat.db')
    return dbInstance
  } catch {
    return null
  }
}

// LocalStorage fallback storage
const ls = {
  get<T>(key: string, def: T): T {
    try {
      const v = localStorage.getItem(key)
      return v ? JSON.parse(v) : def
    } catch { return def }
  },
  set(key: string, val: unknown) {
    localStorage.setItem(key, JSON.stringify(val))
  }
}

// --- Models ---
export async function loadModels(): Promise<ModelConfig[]> {
  const db = await getDb()
  if (db) {
    const rows = (await db.select('SELECT * FROM models ORDER BY created_at ASC')) as any[]
    return rows.map((r: any) => ({
      id: r.id, name: r.name, apiKey: r.api_key,
      baseUrl: r.base_url, modelId: r.model_id, createdAt: r.created_at
    }))
  }
  return ls.get<ModelConfig[]>('models', [])
}

export async function saveModel(model: ModelConfig): Promise<void> {
  const db = await getDb()
  if (db) {
    await db.execute(
      `INSERT OR REPLACE INTO models (id, name, api_key, base_url, model_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [model.id, model.name, model.apiKey, model.baseUrl, model.modelId, model.createdAt]
    )
    return
  }
  const models = ls.get<ModelConfig[]>('models', [])
  const idx = models.findIndex(m => m.id === model.id)
  if (idx >= 0) models[idx] = model
  else models.push(model)
  ls.set('models', models)
}

export async function deleteModel(id: string): Promise<void> {
  const db = await getDb()
  if (db) {
    await db.execute('DELETE FROM models WHERE id = $1', [id])
    return
  }
  const models = ls.get<ModelConfig[]>('models', [])
  ls.set('models', models.filter(m => m.id !== id))
}

// --- Conversations ---
export async function loadConversations(): Promise<Conversation[]> {
  const db = await getDb()
  if (db) {
    const rows = await db.select('SELECT * FROM conversations ORDER BY updated_at DESC') as any[]
    return rows.map(r => ({
      id: r.id, title: r.title, mode: r.mode,
      models: JSON.parse(r.models),
      rootMessageId: r.root_message_id,
      activePathIds: JSON.parse(r.active_path_ids),
      systemPrompt: r.system_prompt ?? undefined,
      modelInstructions: r.model_instructions ? JSON.parse(r.model_instructions) : undefined,
      tags: r.tags ? JSON.parse(r.tags) : [],
      createdAt: r.created_at, updatedAt: r.updated_at
    }))
  }
  return ls.get<Conversation[]>('conversations', [])
}

export async function saveConversation(conv: Conversation): Promise<void> {
  const db = await getDb()
  if (db) {
    await db.execute(
      `INSERT OR REPLACE INTO conversations
       (id, title, mode, models, root_message_id, active_path_ids, system_prompt, model_instructions, tags, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [conv.id, conv.title, conv.mode, JSON.stringify(conv.models),
       conv.rootMessageId, JSON.stringify(conv.activePathIds),
       conv.systemPrompt ?? null,
       conv.modelInstructions ? JSON.stringify(conv.modelInstructions) : null,
       conv.tags?.length ? JSON.stringify(conv.tags) : null,
       conv.createdAt, conv.updatedAt]
    )
    return
  }
  const convs = ls.get<Conversation[]>('conversations', [])
  const idx = convs.findIndex(c => c.id === conv.id)
  if (idx >= 0) convs[idx] = conv
  else convs.push(conv)
  ls.set('conversations', convs)
}

export async function deleteConversation(id: string): Promise<void> {
  const db = await getDb()
  if (db) {
    await db.execute('DELETE FROM conversations WHERE id = $1', [id])
    return
  }
  const convs = ls.get<Conversation[]>('conversations', [])
  ls.set('conversations', convs.filter(c => c.id !== id))
}

// --- Messages ---
export async function loadMessages(conversationId: string): Promise<Message[]> {
  const db = await getDb()
  if (db) {
    const rows = (await db.select(
      'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [conversationId]
    )) as any[]
    return rows.map(r => ({
      id: r.id, conversationId: r.conversation_id,
      parentId: r.parent_id, role: r.role, modelId: r.model_id,
      content: r.content,
      attachments: r.attachments ? JSON.parse(r.attachments) : undefined,
      children: JSON.parse(r.children), createdAt: r.created_at
    }))
  }
  return ls.get<Message[]>(`messages:${conversationId}`, [])
}

export async function saveMessage(msg: Message): Promise<void> {
  const db = await getDb()
  if (db) {
    await db.execute(
      `INSERT OR REPLACE INTO messages
       (id, conversation_id, parent_id, role, model_id, content, attachments, children, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [msg.id, msg.conversationId, msg.parentId, msg.role,
       msg.modelId ?? null, msg.content,
       msg.attachments ? JSON.stringify(msg.attachments) : null,
       JSON.stringify(msg.children), msg.createdAt]
    )
    return
  }
  const msgs = ls.get<Message[]>(`messages:${msg.conversationId}`, [])
  const idx = msgs.findIndex(m => m.id === msg.id)
  if (idx >= 0) msgs[idx] = msg
  else msgs.push(msg)
  ls.set(`messages:${msg.conversationId}`, msgs)
}

export async function deleteMessages(conversationId: string): Promise<void> {
  const db = await getDb()
  if (db) {
    await db.execute('DELETE FROM messages WHERE conversation_id = $1', [conversationId])
    return
  }
  localStorage.removeItem(`messages:${conversationId}`)
}
