import { AIMessage, ToolDefinition } from './ai-gateway'

interface NPC {
  id: string
  name: string
  type: 'agent' | 'ghost'
  systemPrompt: string
  greeting: string
}

interface UserContext {
  id: string
  displayName: string
  role: string
}

export interface BuiltPrompt {
  systemPrompt: string
  messages: AIMessage[]
}

export function buildPrompt(
  npc: NPC,
  conversation: AIMessage[],
  ragChunks: string[],
  tools: ToolDefinition[],
  userContext: UserContext
): BuiltPrompt {
  const lines: string[] = []

  // Core persona
  lines.push(npc.systemPrompt)
  lines.push('')
  lines.push(`Your name is ${npc.name}.`)
  lines.push(`You are speaking with ${userContext.displayName} (role: ${userContext.role}).`)

  if (npc.type === 'ghost') {
    lines.push('')
    lines.push('## Ghost Persona')
    lines.push(
      'You are a ghost — a former colleague who has passed on but still exists in this space. ' +
        'You have no ability to use tools or take actions. You can only share knowledge, memories, and advice. ' +
        'Speak with warmth and a slight sense of nostalgia. Do not break character.'
    )
  }

  // RAG context
  if (ragChunks.length > 0) {
    lines.push('')
    lines.push('## Relevant Knowledge')
    ragChunks.forEach((chunk, i) => {
      lines.push(`### Chunk ${i + 1}`)
      lines.push(chunk)
    })
  }

  // Tools section (agent type only)
  if (npc.type === 'agent' && tools.length > 0) {
    lines.push('')
    lines.push('## Available Tools')
    lines.push(
      'You have access to the following tools. Use them when they would help answer the user\'s request.'
    )
    tools.forEach((t) => {
      lines.push(`- **${t.name}**: ${t.description}`)
    })
  }

  lines.push('')
  lines.push('## Instructions')
  lines.push('- Be helpful, concise, and professional.')
  lines.push('- Base your answers on the knowledge provided above when relevant.')
  lines.push('- If you do not know something, say so honestly.')
  if (npc.type === 'agent') {
    lines.push('- When a tool call is needed, use it rather than guessing.')
  }

  const systemPrompt = lines.join('\n')

  // Build messages: inject greeting as first assistant turn if no history yet
  const messages: AIMessage[] = []
  if (conversation.length === 0) {
    messages.push({ role: 'assistant', content: npc.greeting })
  } else {
    messages.push(...conversation)
  }

  return { systemPrompt, messages }
}
