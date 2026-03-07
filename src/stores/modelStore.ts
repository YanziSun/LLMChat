import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { ModelConfig } from '../types'
import { loadModels, saveModel, deleteModel } from '../lib/db'

interface ModelStore {
  models: ModelConfig[]
  defaultModelId: string | null
  loaded: boolean
  load: () => Promise<void>
  addModel: (data: Omit<ModelConfig, 'id' | 'createdAt'>) => Promise<ModelConfig>
  updateModel: (id: string, data: Partial<Omit<ModelConfig, 'id' | 'createdAt'>>) => Promise<void>
  removeModel: (id: string) => Promise<void>
  setDefault: (id: string) => void
  getModel: (id: string) => ModelConfig | undefined
}

export const useModelStore = create<ModelStore>((set, get) => ({
  models: [],
  defaultModelId: null,
  loaded: false,

  load: async () => {
    const models = await loadModels()
    const defaultId = localStorage.getItem('defaultModelId')
    set({
      models,
      defaultModelId: defaultId || (models[0]?.id ?? null),
      loaded: true
    })
  },

  addModel: async (data) => {
    const model: ModelConfig = {
      id: uuidv4(),
      createdAt: Date.now(),
      ...data,
    }
    await saveModel(model)
    set(s => {
      const models = [...s.models, model]
      return {
        models,
        defaultModelId: s.defaultModelId ?? model.id
      }
    })
    return model
  },

  updateModel: async (id, data) => {
    const model = get().models.find(m => m.id === id)
    if (!model) return
    const updated = { ...model, ...data }
    await saveModel(updated)
    set(s => ({ models: s.models.map(m => m.id === id ? updated : m) }))
  },

  removeModel: async (id) => {
    await deleteModel(id)
    set(s => {
      const models = s.models.filter(m => m.id !== id)
      return {
        models,
        defaultModelId: s.defaultModelId === id ? (models[0]?.id ?? null) : s.defaultModelId
      }
    })
  },

  setDefault: (id) => {
    localStorage.setItem('defaultModelId', id)
    set({ defaultModelId: id })
  },

  getModel: (id) => get().models.find(m => m.id === id),
}))
