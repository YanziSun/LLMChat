import { create } from 'zustand'

interface SettingsStore {
  globalSystemPrompt: string
  setGlobalSystemPrompt: (prompt: string) => void
}

const STORAGE_KEY = 'globalSystemPrompt'

export const useSettingsStore = create<SettingsStore>((set) => ({
  globalSystemPrompt: localStorage.getItem(STORAGE_KEY) ?? '',

  setGlobalSystemPrompt: (prompt) => {
    localStorage.setItem(STORAGE_KEY, prompt)
    set({ globalSystemPrompt: prompt })
  },
}))
