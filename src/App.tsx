import { useEffect, useState } from 'react'
import { Plus, Settings, MessageSquare, Trash2, Bot, GitMerge, RotateCcw, ChevronDown, ChevronUp, ScrollText } from 'lucide-react'
import { useConversationStore } from './stores/conversationStore'
import { useModelStore } from './stores/modelStore'
import { ChatWindow } from './components/chat/ChatWindow'
import { BranchTree } from './components/chat/BranchTree'
import { ModelSettings } from './components/settings/ModelSettings'
import { LogViewer } from './components/logs/LogViewer'
import type { ConversationMode } from './types'
import 'highlight.js/styles/github-dark.css'

type View = 'chat' | 'settings' | 'logs'

const MODE_LABELS: Record<ConversationMode, { label: string; icon: React.ReactNode; desc: string }> = {
  'single': { label: 'Single', icon: <MessageSquare size={14} />, desc: 'One model' },
  'multi-parallel': { label: 'Parallel', icon: <GitMerge size={14} />, desc: 'Compare models side-by-side' },
  'multi-roundrobin': { label: 'Round-robin', icon: <RotateCcw size={14} />, desc: 'Models debate in turns' },
}

function NewConversationModal({
  models,
  onClose,
  onCreate,
}: {
  models: { id: string; name: string }[]
  onClose: () => void
  onCreate: (mode: ConversationMode, modelIds: string[], title: string) => void
}) {
  const [mode, setMode] = useState<ConversationMode>('single')
  const [selectedModels, setSelectedModels] = useState<string[]>(models.slice(0, 1).map(m => m.id))
  const [title, setTitle] = useState('')

  const toggleModel = (id: string) => {
    if (mode === 'single') {
      setSelectedModels([id])
    } else {
      setSelectedModels(prev =>
        prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
      )
    }
  }

  const handleModeChange = (m: ConversationMode) => {
    setMode(m)
    if (m === 'single') setSelectedModels(selectedModels.slice(0, 1))
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-[#1e293b] rounded-2xl p-6 w-[480px] border border-[#334155]"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-white mb-5">New Conversation</h2>

        <div className="mb-4">
          <label className="block text-sm text-slate-400 mb-1">Title (optional)</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="New Conversation"
            className="w-full bg-[#0f1117] border border-[#334155] rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm text-slate-400 mb-2">Mode</label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.entries(MODE_LABELS) as [ConversationMode, typeof MODE_LABELS[ConversationMode]][]).map(([m, info]) => (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-sm transition-colors ${
                  mode === m
                    ? 'border-blue-500 bg-blue-600/20 text-blue-300'
                    : 'border-[#334155] text-slate-400 hover:border-slate-500 hover:text-slate-300'
                }`}
              >
                {info.icon}
                <span className="font-medium">{info.label}</span>
                <span className="text-xs opacity-70 text-center">{info.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm text-slate-400 mb-2">
            {mode === 'single' ? 'Model' : 'Models (select multiple)'}
          </label>
          {models.length === 0 ? (
            <p className="text-sm text-yellow-400">No models configured. Add models in Settings first.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {models.map(m => (
                <button
                  key={m.id}
                  onClick={() => toggleModel(m.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm transition-colors text-left ${
                    selectedModels.includes(m.id)
                      ? 'border-blue-500 bg-blue-600/20 text-blue-300'
                      : 'border-[#334155] text-slate-400 hover:border-slate-500 hover:text-slate-300'
                  }`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                    selectedModels.includes(m.id) ? 'bg-blue-600 border-blue-600' : 'border-slate-500'
                  }`}>
                    {selectedModels.includes(m.id) && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => onCreate(mode, selectedModels, title || 'New Conversation')}
            disabled={selectedModels.length === 0 || models.length === 0}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            Start Chat
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-[#334155] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const {
    conversations, activeConversationId,
    load: loadConversations, loadConversationMessages,
    createConversation, deleteConversation, setActive, updateConversation,
    loaded: convsLoaded
  } = useConversationStore()

  const {
    models, load: loadModels,
  } = useModelStore()

  const [view, setView] = useState<View>('chat')
  const [showNewModal, setShowNewModal] = useState(false)
  const [search, setSearch] = useState('')
  const [showSystemPrompt, setShowSystemPrompt] = useState(false)
  const [systemPromptDraft, setSystemPromptDraft] = useState('')
  const [modelInstructionsDraft, setModelInstructionsDraft] = useState<Record<string, string>>({})
  const [managing, setManaging] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadModels()
    loadConversations()
  }, [])

  useEffect(() => {
    if (activeConversationId) {
      loadConversationMessages(activeConversationId)
    }
    const conv = conversations.find(c => c.id === activeConversationId)
    setSystemPromptDraft(conv?.systemPrompt ?? '')
    setModelInstructionsDraft(conv?.modelInstructions ?? {})
    setShowSystemPrompt(false)
  }, [activeConversationId])

  const handleNewConversation = async (mode: ConversationMode, modelIds: string[], title: string) => {
    setShowNewModal(false)
    await createConversation({ title, mode, models: modelIds })
    setView('chat')
  }

  const handleSelectConversation = (id: string) => {
    setActive(id)
    setView('chat')
  }

  const filteredConversations = conversations
    .filter(c => c.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.updatedAt - a.updatedAt)

  const activeConv = conversations.find(c => c.id === activeConversationId)

  return (
    <div className="flex h-screen bg-[#0f1117] text-[#e2e8f0]">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 flex flex-col bg-[#111827] border-r border-[#1f2937]">
        <div className="px-4 py-4 border-b border-[#1f2937]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <Bot size={16} className="text-white" />
            </div>
            <span className="font-semibold text-white">LLMChat</span>
          </div>
        </div>

        <div className="px-3 pt-3 pb-2">
          <button
            onClick={() => setShowNewModal(true)}
            className="w-full flex items-center gap-2 bg-[#1e293b] hover:bg-[#263245] text-slate-300 hover:text-white px-3 py-2 rounded-xl text-sm transition-colors"
          >
            <Plus size={16} />
            New Chat
          </button>
        </div>

        <div className="px-3 pb-1">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full bg-[#1e293b] border border-transparent focus:border-[#334155] rounded-lg px-3 py-1.5 text-sm text-slate-300 placeholder-slate-600 focus:outline-none transition-colors"
          />
        </div>

        <div className="px-3 pb-2 flex justify-end">
          <button
            onClick={() => { setManaging(v => !v); setSelected(new Set()) }}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              managing
                ? 'text-blue-400 hover:text-blue-300'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {managing ? '取消' : '管理'}
          </button>
        </div>

        {managing && (
          <div className="px-3 pb-2 flex items-center justify-between">
            <span className="text-xs text-slate-500">{selected.size} selected</span>
            <div className="flex gap-2">
              <button
                onClick={() => setSelected(new Set(filteredConversations.map(c => c.id)))}
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                All
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                None
              </button>
              <button
                disabled={selected.size === 0}
                onClick={async () => {
                  for (const id of selected) await deleteConversation(id)
                  setSelected(new Set())
                  setManaging(false)
                }}
                className="text-xs text-red-400 hover:text-red-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-2">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-8 text-slate-600 text-xs">
              {convsLoaded ? 'No conversations yet' : 'Loading...'}
            </div>
          ) : (
            filteredConversations.map(conv => {
              const isSelected = selected.has(conv.id)
              return (
                <div
                  key={conv.id}
                  className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer mb-0.5 transition-colors ${
                    managing
                      ? isSelected
                        ? 'bg-blue-600/20 text-white'
                        : 'text-slate-400 hover:bg-[#1e293b] hover:text-slate-200'
                      : conv.id === activeConversationId
                        ? 'bg-[#1e293b] text-white'
                        : 'text-slate-400 hover:bg-[#1e293b] hover:text-slate-200'
                  }`}
                  onClick={() => {
                    if (managing) {
                      setSelected(s => {
                        const next = new Set(s)
                        next.has(conv.id) ? next.delete(conv.id) : next.add(conv.id)
                        return next
                      })
                    } else {
                      handleSelectConversation(conv.id)
                    }
                  }}
                >
                  {managing && (
                    <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
                      isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-500'
                    }`}>
                      {isSelected && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{conv.title}</div>
                    {conv.mode !== 'single' && (
                      <div className="text-xs text-blue-500/70 mt-0.5">
                        {MODE_LABELS[conv.mode].label}
                      </div>
                    )}
                  </div>
                  {!managing && (
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        deleteConversation(conv.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all p-0.5 rounded"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>

        <div className="px-3 pb-3">
          <BranchTree />
        </div>

        <div className="border-t border-[#1f2937] p-3 flex flex-col gap-1">
          <button
            onClick={() => setView(view === 'logs' ? 'chat' : 'logs')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              view === 'logs'
                ? 'bg-[#1e293b] text-white'
                : 'text-slate-400 hover:bg-[#1e293b] hover:text-slate-300'
            }`}
          >
            <ScrollText size={16} />
            Logs
          </button>
          <button
            onClick={() => setView(view === 'settings' ? 'chat' : 'settings')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              view === 'settings'
                ? 'bg-[#1e293b] text-white'
                : 'text-slate-400 hover:bg-[#1e293b] hover:text-slate-300'
            }`}
          >
            <Settings size={16} />
            Settings
            <span className="ml-auto text-xs text-slate-600">{models.length} models</span>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {view === 'chat' && activeConv && (
          <div className="border-b border-[#1f2937]">
            <div className="px-6 py-3 flex items-center gap-3">
              <h1 className="font-medium text-white text-sm truncate">{activeConv.title}</h1>
              <div className="flex items-center gap-2 ml-auto">
                {activeConv.mode !== 'single' && (
                  <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded-full">
                    {MODE_LABELS[activeConv.mode].label}
                  </span>
                )}
                <span className="text-xs text-slate-600">
                  {activeConv.models.map(id => models.find(m => m.id === id)?.name ?? id).join(', ')}
                </span>
                <button
                  onClick={() => setShowSystemPrompt(v => !v)}
                  title="Per-conversation system instructions"
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors ${
                    showSystemPrompt || activeConv.systemPrompt ||
                    (activeConv.modelInstructions && Object.keys(activeConv.modelInstructions).length > 0)
                      ? 'text-purple-400 bg-purple-500/10 hover:bg-purple-500/20'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-[#1e293b]'
                  }`}
                >
                  Instructions
                  {showSystemPrompt ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              </div>
            </div>
            {showSystemPrompt && (
              <div className="px-6 pb-3">
                {activeConv.mode === 'multi-roundrobin' ? (
                  // Per-model instructions for round-robin participants
                  <div className="space-y-2">
                    {activeConv.models.map(modelId => {
                      const modelName = models.find(m => m.id === modelId)?.name ?? modelId
                      return (
                        <div key={modelId} className="flex gap-2 items-start">
                          <span className="text-xs text-slate-400 w-28 flex-shrink-0 pt-2 truncate" title={modelName}>
                            {modelName}
                          </span>
                          <textarea
                            value={modelInstructionsDraft[modelId] ?? ''}
                            onChange={e => setModelInstructionsDraft(d => ({ ...d, [modelId]: e.target.value }))}
                            placeholder={`Instructions for ${modelName}...`}
                            rows={2}
                            className="flex-1 bg-[#0f1117] border border-[#334155] rounded-lg px-3 py-2 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-purple-500 resize-none"
                          />
                        </div>
                      )
                    })}
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => {
                          const cleaned = Object.fromEntries(
                            Object.entries(modelInstructionsDraft).filter(([, v]) => v.trim())
                          )
                          updateConversation(activeConv.id, {
                            modelInstructions: Object.keys(cleaned).length ? cleaned : undefined
                          })
                          setShowSystemPrompt(false)
                        }}
                        className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg transition-colors"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  // Single system prompt for single / parallel modes
                  <div className="flex gap-2 items-start">
                    <textarea
                      value={systemPromptDraft}
                      onChange={e => setSystemPromptDraft(e.target.value)}
                      placeholder="Per-conversation system instructions (overrides global)..."
                      rows={2}
                      className="flex-1 bg-[#0f1117] border border-[#334155] rounded-lg px-3 py-2 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-purple-500 resize-none"
                    />
                    <button
                      onClick={() => {
                        updateConversation(activeConv.id, { systemPrompt: systemPromptDraft || undefined })
                        setShowSystemPrompt(false)
                      }}
                      className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg transition-colors"
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {view === 'settings' ? (
          <ModelSettings />
        ) : view === 'logs' ? (
          <LogViewer />
        ) : (
          <ChatWindow />
        )}
      </div>

      {showNewModal && (
        <NewConversationModal
          models={models}
          onClose={() => setShowNewModal(false)}
          onCreate={handleNewConversation}
        />
      )}
    </div>
  )
}
