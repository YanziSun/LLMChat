# Conversation Tags — Design Spec

**Date:** 2026-03-17
**Status:** Approved
**Feature scope:** Add a tagging system to LLMChat conversations for organization and filtering.

---

## Problem

As a content creator using LLMChat daily, conversations accumulate quickly across different projects (小红书文案、视频脚本、翻译、选题策划). The current sidebar only supports text search and chronological ordering. There is no way to categorize or filter conversations by topic.

---

## Goals

- Allow users to attach one or more tags to any conversation
- Display tags visually in the conversation header and sidebar list
- Support tag-based filtering in the sidebar
- Tags are global (shared across all conversations), color-coded by name hash

---

## Non-Goals

- Folders / nested hierarchy (tags only)
- Tag renaming or bulk re-tagging
- Tag-based search in message content

---

## Design

### Data Model

Add `tags?: string[]` to the `Conversation` interface in `src/types/index.ts`.

Tags are stored as a JSON array in the `conversations` table under a new `tags` column (TEXT, nullable, defaults to NULL meaning empty array).

```ts
// src/types/index.ts — change
interface Conversation {
  // ... existing fields ...
  tags?: string[]   // NEW
}
```

### Database Migration

Migration v5 in `src-tauri/src/lib.rs`:

```sql
ALTER TABLE conversations ADD COLUMN tags TEXT DEFAULT NULL;
```

`NULL` is treated as `[]` on read. Written as `JSON.stringify(tags)` or `null` when empty.

### DB Layer (`src/lib/db.ts`)

**`loadConversations`:** add `tags: r.tags ? JSON.parse(r.tags) : []` to the row mapping.

**`saveConversation`:** add `conv.tags?.length ? JSON.stringify(conv.tags) : null` as the 11th parameter to the INSERT OR REPLACE query.

No new functions needed — `updateConversation` in the store already calls `saveConversation` with the full conversation object, so tag updates flow through automatically.

### Tag Color System

A deterministic hash function maps each tag name to one of 8 color pairs (background + text), so the same tag always renders in the same color across the entire app:

```ts
const TAG_COLORS = [
  { bg: '#1d4ed8', text: '#bfdbfe' },  // blue
  { bg: '#14532d', text: '#86efac' },  // green
  { bg: '#7c3aed', text: '#ddd6fe' },  // purple
  { bg: '#92400e', text: '#fde68a' },  // amber
  { bg: '#881337', text: '#fecdd3' },  // rose
  { bg: '#164e63', text: '#a5f3fc' },  // cyan
  { bg: '#713f12', text: '#fed7aa' },  // orange
  { bg: '#1e3a5f', text: '#bae6fd' },  // sky
]

function tagColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return TAG_COLORS[h % TAG_COLORS.length]
}
```

### UI — Three Touch Points (all in `src/App.tsx`)

#### 1. Tag filter strip (sidebar, below search input)

- Compute `allTags`: deduplicate all tags across all conversations
- Render as a horizontally scrollable row of pill buttons below the search input
- Active tag is highlighted in its color; clicking toggles it as the active filter
- Only one tag can be active at a time (simple filter, not multi-select)
- When a tag filter is active, `filteredConversations` is additionally filtered to conversations containing that tag

```tsx
const [activeTag, setActiveTag] = useState<string | null>(null)
const allTags = [...new Set(conversations.flatMap(c => c.tags ?? []))]

// In filteredConversations:
.filter(c => !activeTag || (c.tags ?? []).includes(activeTag))
```

#### 2. Tag pills in sidebar conversation list items

- Below each conversation title, render its tags as tiny pills (9–10px font)
- Only rendered when the conversation has ≥1 tag
- No interaction — display only

#### 3. Tag row in chat header

- A new thin row below the existing title bar (only shown when a conversation is active)
- Left side: "标签" label + existing tag pills (each with an `×` remove button)
- Right side: `+ 添加` button that opens a `TagPicker` inline dropdown

**TagPicker dropdown:**
- Text input for searching or creating new tags
- Lists existing global tags as selectable pills (already-applied tags shown with a checkmark)
- Pressing Enter or clicking a tag that doesn't exist yet creates and applies it
- Clicking an existing tag toggles it on/off
- Closes on outside click (via `useEffect` with `mousedown` listener)

---

## Files Changed

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `tags?: string[]` to `Conversation` |
| `src-tauri/src/lib.rs` | Add Migration v5 (`ALTER TABLE conversations ADD COLUMN tags`) |
| `src/lib/db.ts` | Read/write `tags` column in `loadConversations` / `saveConversation` |
| `src/App.tsx` | Tag filter strip, tag pills in list, tag row + TagPicker in chat header |

No new files. No new store methods. No new Rust commands.

---

## Interaction Flow

1. User opens a conversation → sees tag row in header (empty if no tags)
2. User clicks `+ 添加` → TagPicker dropdown opens, shows all existing tags
3. User types `小红书` → if it exists, highlight it; press Enter or click to apply
4. Tag appears as a colored pill in the header with `×`
5. User clicks `×` on a tag → tag removed from this conversation
6. In the sidebar, the conversation now shows a small `#小红书` pill under its title
7. User clicks the `#小红书` pill in the tag filter strip → list filters to only tagged conversations
8. Clicking the active tag pill again clears the filter

---

## Edge Cases

- Tag name is trimmed and lowercased on creation to avoid `小红书` vs `小红书 ` duplicates
- Empty tag name (after trim) → silently ignored
- Conversations with `tags: undefined` or `tags: []` treated the same (no pills shown)
- localStorage fallback: `tags` field handled the same way since `saveConversation` writes the full object
