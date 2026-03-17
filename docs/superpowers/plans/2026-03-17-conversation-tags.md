# Conversation Tags Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a tag system to LLMChat so users can label conversations and filter the sidebar by tag.

**Architecture:** Tags are stored as a JSON array in a new `tags` column on the `conversations` table (Migration v5). The data flows through the existing `updateConversation` store method unchanged. All UI lives in `src/App.tsx` — a tag filter strip below the sidebar search, tag pills in each conversation list item, and a tag row with a `TagPicker` dropdown in the chat header.

**Tech Stack:** TypeScript, React, Zustand, SQLite via tauri-plugin-sql, TailwindCSS v3

**Spec:** `docs/superpowers/specs/2026-03-17-conversation-tags-design.md`

---

## Chunk 1: Data Layer

### Task 1: Add `tags` field to the `Conversation` type

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Open `src/types/index.ts` and add `tags?: string[]` to `Conversation`**

  The `Conversation` interface currently ends with `updatedAt: number`. Add one line after it:

  ```ts
  export interface Conversation {
    id: string
    title: string
    mode: ConversationMode
    models: string[]
    rootMessageId: string | null
    activePathIds: string[]
    systemPrompt?: string
    modelInstructions?: Record<string, string>
    tags?: string[]        // ← ADD THIS
    createdAt: number
    updatedAt: number
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles without errors**

  ```bash
  npm run build 2>&1 | head -30
  ```
  Expected: no errors referencing `tags`.

- [ ] **Step 3: Commit**

  ```bash
  git add src/types/index.ts
  git commit -m "feat(types): add tags field to Conversation"
  ```

---

### Task 2: Add SQLite migration v5

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add Migration v5 after the existing v4 block**

  In `src-tauri/src/lib.rs`, find the closing `},` of the v4 migration and add after it:

  ```rust
  Migration {
      version: 5,
      description: "add_tags_to_conversations",
      sql: "ALTER TABLE conversations ADD COLUMN tags TEXT DEFAULT NULL;",
      kind: MigrationKind::Up,
  },
  ```

- [ ] **Step 2: Verify Rust compiles**

  ```bash
  cd src-tauri && cargo check 2>&1 | tail -5
  ```
  Expected: `Finished` with no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src-tauri/src/lib.rs
  git commit -m "feat(db): migration v5 — add tags column to conversations"
  ```

---

### Task 3: Read and write `tags` in `db.ts`

**Files:**
- Modify: `src/lib/db.ts`

- [ ] **Step 1: Update `loadConversations` to parse the `tags` column**

  In the `rows.map(r => ({ ... }))` block inside `loadConversations`, add after the `modelInstructions` line:

  ```ts
  tags: r.tags ? JSON.parse(r.tags) : [],
  ```

  The full mapping should now look like:
  ```ts
  return rows.map(r => ({
    id: r.id, title: r.title, mode: r.mode,
    models: JSON.parse(r.models),
    rootMessageId: r.root_message_id,
    activePathIds: JSON.parse(r.active_path_ids),
    systemPrompt: r.system_prompt ?? undefined,
    modelInstructions: r.model_instructions ? JSON.parse(r.model_instructions) : undefined,
    tags: r.tags ? JSON.parse(r.tags) : [],   // ← ADD
    createdAt: r.created_at, updatedAt: r.updated_at
  }))
  ```

- [ ] **Step 2: Update `saveConversation` to persist the `tags` column**

  The INSERT OR REPLACE query currently has 10 columns and 10 parameters. Add `tags` as the 11th:

  **Before:**
  ```ts
  `INSERT OR REPLACE INTO conversations
   (id, title, mode, models, root_message_id, active_path_ids, system_prompt, model_instructions, created_at, updated_at)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
  [conv.id, conv.title, conv.mode, JSON.stringify(conv.models),
   conv.rootMessageId, JSON.stringify(conv.activePathIds),
   conv.systemPrompt ?? null,
   conv.modelInstructions ? JSON.stringify(conv.modelInstructions) : null,
   conv.createdAt, conv.updatedAt]
  ```

  **After:**
  ```ts
  `INSERT OR REPLACE INTO conversations
   (id, title, mode, models, root_message_id, active_path_ids, system_prompt, model_instructions, tags, created_at, updated_at)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
  [conv.id, conv.title, conv.mode, JSON.stringify(conv.models),
   conv.rootMessageId, JSON.stringify(conv.activePathIds),
   conv.systemPrompt ?? null,
   conv.modelInstructions ? JSON.stringify(conv.modelInstructions) : null,
   conv.tags?.length ? JSON.stringify(conv.tags) : null,
   conv.createdAt, conv.updatedAt]
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  ```bash
  npm run build 2>&1 | head -30
  ```
  Expected: no errors.

- [ ] **Step 4: Smoke-test in dev mode**

  ```bash
  ./start.sh
  ```
  - Create a new conversation → it should load without errors.
  - Open DevTools Console → no errors about `tags`.

- [ ] **Step 5: Commit**

  ```bash
  git add src/lib/db.ts
  git commit -m "feat(db): persist tags field in conversations table"
  ```

---

## Chunk 2: UI Layer

### Task 4: Tag color utility function

**Files:**
- Modify: `src/App.tsx` (add near the top, after imports)

- [ ] **Step 1: Add `TAG_COLORS` constant and `tagColor` helper before the `NewConversationModal` component**

  ```ts
  const TAG_COLORS = [
    { bg: '#1d4ed8', text: '#bfdbfe' },
    { bg: '#14532d', text: '#86efac' },
    { bg: '#7c3aed', text: '#ddd6fe' },
    { bg: '#92400e', text: '#fde68a' },
    { bg: '#881337', text: '#fecdd3' },
    { bg: '#164e63', text: '#a5f3fc' },
    { bg: '#713f12', text: '#fed7aa' },
    { bg: '#1e3a5f', text: '#bae6fd' },
  ]

  function tagColor(name: string): { bg: string; text: string } {
    let h = 0
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
    return TAG_COLORS[h % TAG_COLORS.length]
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  npm run build 2>&1 | head -20
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add src/App.tsx
  git commit -m "feat(tags): add tagColor utility"
  ```

---

### Task 5: TagPicker dropdown component

**Files:**
- Modify: `src/App.tsx` (add `TagPicker` component before the `App` default export)

- [ ] **Step 1: Add the `TagPicker` component**

  Add this component just before `export default function App()`:

  ```tsx
  function TagPicker({
    currentTags,
    allTags,
    onAdd,
    onRemove,
    onClose,
  }: {
    currentTags: string[]
    allTags: string[]
    onAdd: (tag: string) => void
    onRemove: (tag: string) => void
    onClose: () => void
  }) {
    const [input, setInput] = useState('')
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
      function handleClick(e: MouseEvent) {
        if (ref.current && !ref.current.contains(e.target as Node)) onClose()
      }
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }, [onClose])

    const filtered = allTags.filter(t =>
      t.includes(input.toLowerCase()) && !currentTags.includes(t)
    )
    const canCreate = input.trim() && !allTags.includes(input.trim().toLowerCase())

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        const val = input.trim().toLowerCase()
        if (!val) return
        onAdd(val)
        setInput('')
      }
    }

    return (
      <div
        ref={ref}
        className="absolute top-full left-0 mt-1 z-50 bg-[#1e293b] border border-[#334155] rounded-xl shadow-xl p-3 w-52"
      >
        <input
          autoFocus
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="新建或搜索标签..."
          className="w-full bg-[#0f1117] border border-[#334155] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 mb-2"
        />
        <div className="flex flex-wrap gap-1.5">
          {canCreate && (
            <button
              onClick={() => { onAdd(input.trim().toLowerCase()); setInput('') }}
              className="text-[10px] border border-dashed border-blue-500 text-blue-400 px-2 py-0.5 rounded-full hover:bg-blue-500/10 transition-colors"
            >
              + 创建 "{input.trim()}"
            </button>
          )}
          {filtered.map(tag => {
            const { bg, text } = tagColor(tag)
            return (
              <button
                key={tag}
                onClick={() => onAdd(tag)}
                style={{ background: bg, color: text }}
                className="text-[10px] px-2 py-0.5 rounded-full hover:opacity-80 transition-opacity"
              >
                #{tag}
              </button>
            )
          })}
          {currentTags.map(tag => {
            const { bg, text } = tagColor(tag)
            return (
              <button
                key={tag}
                onClick={() => onRemove(tag)}
                style={{ background: bg, color: text, opacity: 0.5 }}
                className="text-[10px] px-2 py-0.5 rounded-full hover:opacity-80 transition-opacity line-through"
                title="点击移除"
              >
                #{tag}
              </button>
            )
          })}
        </div>
      </div>
    )
  }
  ```

  Note: `useState`, `useRef`, `useEffect` are already imported at the top of `App.tsx`.

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  npm run build 2>&1 | head -20
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add src/App.tsx
  git commit -m "feat(tags): add TagPicker dropdown component"
  ```

---

### Task 6: Tag filter strip in sidebar

**Files:**
- Modify: `src/App.tsx` (inside the `App` function)

- [ ] **Step 1: Add `activeTag` state to the `App` function**

  After the existing `useState` declarations (around line 156), add:

  ```ts
  const [activeTag, setActiveTag] = useState<string | null>(null)
  ```

- [ ] **Step 2: Compute `allTags` and update `filteredConversations`**

  After the `activeTag` state line, add:

  ```ts
  const allTags = [...new Set(conversations.flatMap(c => c.tags ?? []))]
  ```

  Then update the `filteredConversations` definition to also filter by `activeTag`:

  ```ts
  const filteredConversations = conversations
    .filter(c => c.title.toLowerCase().includes(search.toLowerCase()))
    .filter(c => !activeTag || (c.tags ?? []).includes(activeTag))
    .sort((a, b) => b.updatedAt - a.updatedAt)
  ```

- [ ] **Step 3: Render the tag filter strip in the sidebar**

  In the sidebar JSX, between the search input `<div>` and the management bar `<div>`, add:

  ```tsx
  {allTags.length > 0 && (
    <div className="px-3 pb-1 flex gap-1.5 flex-wrap">
      {allTags.map(tag => {
        const { bg, text } = tagColor(tag)
        const isActive = activeTag === tag
        return (
          <button
            key={tag}
            onClick={() => setActiveTag(isActive ? null : tag)}
            style={isActive ? { background: bg, color: text } : {}}
            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
              isActive
                ? 'border-transparent'
                : 'border-[#334155] text-slate-500 hover:text-slate-300'
            }`}
          >
            #{tag}
          </button>
        )
      })}
    </div>
  )}
  ```

- [ ] **Step 4: Verify in dev mode**

  ```bash
  ./start.sh
  ```
  - Add a tag to a conversation (in the next task) and confirm the filter strip appears.
  - Clicking an active tag should clear the filter.

- [ ] **Step 5: Commit**

  ```bash
  git add src/App.tsx
  git commit -m "feat(tags): sidebar tag filter strip"
  ```

---

### Task 7: Tag pills in conversation list items

**Files:**
- Modify: `src/App.tsx` (inside the sidebar conversation list map)

- [ ] **Step 1: Add tag pills below each conversation title in the list**

  In the conversation list map (around line 313, inside the `<div className="flex-1 min-w-0">` block), after the title `<div>` and the mode badge `<div>`, add:

  ```tsx
  {(conv.tags ?? []).length > 0 && (
    <div className="flex gap-1 flex-wrap mt-0.5">
      {(conv.tags ?? []).map(tag => {
        const { bg, text } = tagColor(tag)
        return (
          <span
            key={tag}
            style={{ background: bg, color: text }}
            className="text-[9px] px-1.5 py-0 rounded-full leading-4"
          >
            #{tag}
          </span>
        )
      })}
    </div>
  )}
  ```

- [ ] **Step 2: Verify in dev mode**

  ```bash
  ./start.sh
  ```
  After tagging a conversation (Task 8), confirm pills appear under its title in the list.

- [ ] **Step 3: Commit**

  ```bash
  git add src/App.tsx
  git commit -m "feat(tags): show tag pills in sidebar conversation list"
  ```

---

### Task 8: Tag row in chat header

**Files:**
- Modify: `src/App.tsx` (in the main content area header)

- [ ] **Step 1: Add `showTagPicker` state to the `App` function**

  ```ts
  const [showTagPicker, setShowTagPicker] = useState(false)
  ```

- [ ] **Step 2: Add the tag row inside the existing chat header container**

  The existing header block in `App.tsx` (around line 372) looks like this:

  ```tsx
  {view === 'chat' && activeConv && (
    <div className="border-b border-[#1f2937]">
      <div className="px-6 py-3 flex items-center gap-3">
        {/* title, mode badge, models, Instructions button */}
      </div>
      {showSystemPrompt && (
        <div className="px-6 pb-3">...</div>
      )}
    </div>
  )}
  ```

  Insert the tag row **inside** `<div className="border-b border-[#1f2937]">`, after the title row `<div>` and before `{showSystemPrompt && ...}`:

  ```tsx
  {view === 'chat' && activeConv && (
    <div className="border-b border-[#1f2937]">
      <div className="px-6 py-3 flex items-center gap-3">
        {/* existing title row — unchanged */}
      </div>

      {/* ── NEW: Tag row ───────────────────────────── */}
      <div className="px-6 py-1.5 flex items-center gap-2 flex-wrap border-t border-[#1f2937]/50">
        <span className="text-[10px] text-slate-600 flex-shrink-0">标签</span>
        {(activeConv.tags ?? []).map(tag => {
          const { bg, text } = tagColor(tag)
          return (
            <span
              key={tag}
              style={{ background: bg, color: text }}
              className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1"
            >
              #{tag}
              <button
                onClick={() => {
                  const newTags = (activeConv.tags ?? []).filter(t => t !== tag)
                  updateConversation(activeConv.id, { tags: newTags })
                }}
                className="hover:opacity-70 transition-opacity"
              >
                ×
              </button>
            </span>
          )
        })}
        <div className="relative">
          <button
            onClick={() => setShowTagPicker(v => !v)}
            className="text-[10px] border border-dashed border-slate-600 text-slate-500 hover:text-slate-300 hover:border-slate-400 px-2 py-0.5 rounded-full transition-colors"
          >
            + 添加
          </button>
          {showTagPicker && (
            <TagPicker
              currentTags={activeConv.tags ?? []}
              allTags={allTags}
              onAdd={tag => {
                const current = activeConv.tags ?? []
                if (!current.includes(tag)) {
                  updateConversation(activeConv.id, { tags: [...current, tag] })
                }
              }}
              onRemove={tag => {
                updateConversation(activeConv.id, {
                  tags: (activeConv.tags ?? []).filter(t => t !== tag)
                })
              }}
              onClose={() => setShowTagPicker(false)}
            />
          )}
        </div>
      </div>
      {/* ────────────────────────────────────────────── */}

      {showSystemPrompt && (
        <div className="px-6 pb-3">...</div>
      )}
    </div>
  )}
  ```

  `updateConversation` is already destructured from `useConversationStore` in the `App` function (used by the system prompt save) — no change needed there.

- [ ] **Step 3: Close tag picker when switching conversations**

  In the existing `useEffect` that watches `activeConversationId` (around line 167), add:

  ```ts
  setShowTagPicker(false)
  ```

- [ ] **Step 4: Full end-to-end verification in dev mode**

  ```bash
  ./start.sh
  ```
  - Open a conversation
  - Click `+ 添加` → TagPicker opens
  - Type `小红书` → see "创建 小红书" button → press Enter or click it
  - Tag `#小红书` appears as a colored pill in the header
  - Pill also appears in sidebar list item
  - Click the tag in the sidebar filter strip → list filters to only this conversation
  - Click `×` on the pill → tag removed
  - Restart the app → tags persist (loaded from SQLite)

- [ ] **Step 5: Commit**

  ```bash
  git add src/App.tsx
  git commit -m "feat(tags): chat header tag row with TagPicker"
  ```
