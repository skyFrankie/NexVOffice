import { db } from '../db/connection'
import { npcMcpConnections, npcToolPermissions } from '../db/schema'
import { eq, and } from 'drizzle-orm'

export interface MCPTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

interface MCPResponse {
  result?: unknown
  error?: string
}

async function mcpFetch(
  serverUrl: string,
  method: string,
  params: Record<string, unknown>,
  userToken?: string
): Promise<unknown> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (userToken) {
    headers['Authorization'] = `Bearer ${userToken}`
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  let response: Response
  try {
    response = await fetch(serverUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }

  if (!response.ok) {
    throw new Error(`MCP server error: ${response.status}`)
  }

  const data = (await response.json()) as MCPResponse
  if (data.error) {
    throw new Error(`MCP error: ${data.error}`)
  }
  return data.result
}

export async function connect(serverUrl: string): Promise<boolean> {
  try {
    await mcpFetch(serverUrl, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'nexvoffice-npc', version: '1.0.0' },
    })
    return true
  } catch {
    return false
  }
}

export async function discoverTools(connectionId: string): Promise<MCPTool[]> {
  const connections = await db
    .select()
    .from(npcMcpConnections)
    .where(
      and(eq(npcMcpConnections.id, connectionId), eq(npcMcpConnections.isActive, true))
    )
    .limit(1)

  if (connections.length === 0) return []
  const conn = connections[0]

  try {
    const result = (await mcpFetch(conn.mcpServerUrl, 'tools/list', {})) as {
      tools?: MCPTool[]
    }
    return result?.tools ?? []
  } catch {
    return []
  }
}

export async function callTool(
  connectionId: string,
  toolName: string,
  params: Record<string, unknown>,
  userToken?: string
): Promise<unknown> {
  // Check whitelist
  const permission = await db
    .select()
    .from(npcToolPermissions)
    .where(
      and(
        eq(npcToolPermissions.mcpConnectionId, connectionId),
        eq(npcToolPermissions.toolName, toolName),
        eq(npcToolPermissions.isAllowed, true)
      )
    )
    .limit(1)

  if (permission.length === 0) {
    throw new Error(`Tool '${toolName}' is not permitted for this NPC`)
  }

  const connections = await db
    .select()
    .from(npcMcpConnections)
    .where(
      and(eq(npcMcpConnections.id, connectionId), eq(npcMcpConnections.isActive, true))
    )
    .limit(1)

  if (connections.length === 0) {
    throw new Error('MCP connection not found or inactive')
  }

  const conn = connections[0]
  return mcpFetch(conn.mcpServerUrl, 'tools/call', { name: toolName, arguments: params }, userToken)
}
