import { useState } from 'react'
import { Plus, Trash2, CheckCircle, XCircle, Loader2, Star, Edit2, X } from 'lucide-react'
import { useModelStore } from '../../stores/modelStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { testConnection } from '../../lib/api'
import type { ModelConfig } from '../../types'

interface ModelFormData {
  name: string
  apiKey: string
  baseUrl: string
  modelId: string
}

const defaultForm: ModelFormData = {
  name: '',
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  modelId: 'gpt-4o',
}

export function ModelSettings() {
  const { models, defaultModelId, addModel, updateModel, removeModel, setDefault } = useModelStore()
  const { globalSystemPrompt, setGlobalSystemPrompt } = useSettingsStore()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ModelFormData>(defaultForm)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; error?: string }>>({})
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.apiKey || !form.baseUrl || !form.modelId) return
    setSaving(true)
    try {
      if (editingId) {
        await updateModel(editingId, form)
      } else {
        await addModel(form)
      }
      setShowForm(false)
      setEditingId(null)
      setForm(defaultForm)
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (model: ModelConfig) => {
    setEditingId(model.id)
    setForm({ name: model.name, apiKey: model.apiKey, baseUrl: model.baseUrl, modelId: model.modelId })
    setShowForm(true)
  }

  const cancelForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(defaultForm)
  }

  const handleTest = async (model: ModelConfig) => {
    setTesting(model.id)
    setTestResult(r => ({ ...r, [model.id]: undefined as any }))
    const result = await testConnection(model)
    setTestResult(r => ({ ...r, [model.id]: result }))
    setTesting(null)
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Model Settings</h2>
          <button
            onClick={() => { setShowForm(true); setEditingId(null); setForm(defaultForm) }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <Plus size={16} />
            Add Model
          </button>
        </div>

        {showForm && (
          <div className="bg-[#1e293b] rounded-xl p-5 mb-6 border border-[#334155]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-white">{editingId ? 'Edit Model' : 'Add Model'}</h3>
              <button onClick={cancelForm} className="text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Display Name</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. GPT-4o"
                  className="w-full bg-[#0f1117] border border-[#334155] rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">API Key</label>
                <input
                  value={form.apiKey}
                  onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
                  type="password"
                  placeholder="sk-..."
                  className="w-full bg-[#0f1117] border border-[#334155] rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Base URL</label>
                <input
                  value={form.baseUrl}
                  onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))}
                  placeholder="https://api.openai.com/v1"
                  className="w-full bg-[#0f1117] border border-[#334155] rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Model ID</label>
                <input
                  value={form.modelId}
                  onChange={e => setForm(f => ({ ...f, modelId: e.target.value }))}
                  placeholder="gpt-4o"
                  className="w-full bg-[#0f1117] border border-[#334155] rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {editingId ? 'Update' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={cancelForm}
                  className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-[#334155] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Global System Prompt */}
        <div className="bg-[#1e293b] rounded-xl p-5 mb-6 border border-[#334155]">
          <h3 className="font-medium text-white mb-1">Global System Instructions</h3>
          <p className="text-xs text-slate-500 mb-3">Applied to every conversation unless overridden by a per-conversation instruction.</p>
          <textarea
            value={globalSystemPrompt}
            onChange={e => setGlobalSystemPrompt(e.target.value)}
            placeholder="e.g. You are a helpful assistant. Always respond in English."
            rows={4}
            className="w-full bg-[#0f1117] border border-[#334155] rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>

        {models.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <p className="mb-2">No models configured</p>
            <p className="text-sm">Click "Add Model" to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {models.map(model => (
              <div key={model.id} className="bg-[#1e293b] rounded-xl p-4 border border-[#334155]">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{model.name}</span>
                      {defaultModelId === model.id && (
                        <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">Default</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-1 space-y-0.5">
                      <div>Model: <span className="text-slate-300">{model.modelId}</span></div>
                      <div className="truncate">URL: <span className="text-slate-300">{model.baseUrl}</span></div>
                    </div>
                    {testResult[model.id] && (
                      <div className={`flex items-center gap-1.5 mt-2 text-xs ${testResult[model.id].ok ? 'text-green-400' : 'text-red-400'}`}>
                        {testResult[model.id].ok
                          ? <><CheckCircle size={12} /> Connection successful</>
                          : <><XCircle size={12} /> {testResult[model.id].error}</>
                        }
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-3">
                    <button
                      onClick={() => handleTest(model)}
                      disabled={testing === model.id}
                      className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-[#334155] transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      {testing === model.id
                        ? <><Loader2 size={12} className="animate-spin" /> Testing...</>
                        : 'Test'
                      }
                    </button>
                    {defaultModelId !== model.id && (
                      <button
                        onClick={() => setDefault(model.id)}
                        title="Set as default"
                        className="text-slate-400 hover:text-yellow-400 p-1.5 rounded-lg hover:bg-[#334155] transition-colors"
                      >
                        <Star size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(model)}
                      className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-[#334155] transition-colors"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => removeModel(model.id)}
                      className="text-slate-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-[#334155] transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
