import { GitBranch, MessageSquare } from 'lucide-react'
import type { Message } from '../../types'
import { useConversationStore } from '../../stores/conversationStore'

interface TreeNodeProps {
  messageId: string
  messages: Record<string, Message>
  activePathIds: Set<string>
  depth: number
  onSelectPath: (pathIds: string[]) => void
}

function buildPathToNode(messageId: string, messages: Record<string, Message>): string[] {
  const path: string[] = []
  let current: Message | undefined = messages[messageId]
  while (current) {
    path.unshift(current.id)
    current = current.parentId ? messages[current.parentId] : undefined
  }
  return path
}

function TreeNode({ messageId, messages, activePathIds, depth, onSelectPath }: TreeNodeProps) {
  const msg = messages[messageId]
  if (!msg) return null

  const isActive = activePathIds.has(messageId)
  const hasChildren = msg.children.length > 0
  const hasBranch = msg.children.length > 1

  const snippet = msg.content.slice(0, 40) + (msg.content.length > 40 ? '...' : '')

  return (
    <div>
      <div
        className={`flex items-start gap-2 py-1 px-2 rounded-lg cursor-pointer text-xs transition-colors
          ${isActive ? 'bg-blue-600/20 text-blue-300' : 'text-slate-500 hover:text-slate-300 hover:bg-[#1e293b]'}
        `}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => {
          const path = buildPathToNode(messageId, messages)
          // Find the deepest leaf in the current branch
          let leafId = messageId
          while (messages[leafId]?.children.length > 0) {
            leafId = messages[leafId].children[0]
          }
          onSelectPath(buildPathToNode(leafId, messages))
        }}
      >
        <div className="mt-0.5 flex-shrink-0">
          {hasBranch
            ? <GitBranch size={11} className="text-yellow-500" />
            : <MessageSquare size={11} />
          }
        </div>
        <span className="truncate flex-1">
          {msg.role === 'user' ? '→ ' : ''}{snippet}
        </span>
      </div>

      {hasChildren && (
        <div className="relative">
          {msg.children.length > 1 && (
            <div
              className="absolute left-0 top-0 bottom-0 w-px bg-yellow-500/30"
              style={{ left: `${14 + depth * 14}px` }}
            />
          )}
          {msg.children.map(childId => (
            <TreeNode
              key={childId}
              messageId={childId}
              messages={messages}
              activePathIds={activePathIds}
              depth={depth + 1}
              onSelectPath={onSelectPath}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function BranchTree() {
  const { getConversation, getMessageMap, setActivePath, activeConversationId } = useConversationStore()
  const conv = getConversation()
  const messages = getMessageMap()

  if (!conv || !conv.rootMessageId) return null

  // Check if there's actually branching
  const hasBranching = Object.values(messages)
    .some(m => m.conversationId === conv.id && m.children.length > 1)

  if (!hasBranching) return null

  const activePathIds = new Set(conv.activePathIds)

  const handleSelectPath = (pathIds: string[]) => {
    if (activeConversationId) {
      setActivePath(activeConversationId, pathIds)
    }
  }

  return (
    <div className="border-t border-[#334155] pt-3 mt-3">
      <div className="text-xs text-slate-500 uppercase tracking-wider px-2 mb-2 flex items-center gap-1.5">
        <GitBranch size={11} />
        Branch Tree
      </div>
      <div className="overflow-y-auto max-h-48">
        <TreeNode
          messageId={conv.rootMessageId}
          messages={messages}
          activePathIds={activePathIds}
          depth={0}
          onSelectPath={handleSelectPath}
        />
      </div>
    </div>
  )
}
