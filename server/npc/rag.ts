import { db } from '../db/connection'
import { npcEmbeddings, npcKnowledgeSources } from '../db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { aiGateway } from './ai-gateway'

const CHUNK_TOKENS = 500
const OVERLAP_TOKENS = 100
// Approximate: 1 token ~ 4 chars
const CHARS_PER_TOKEN = 4
const CHUNK_SIZE = CHUNK_TOKENS * CHARS_PER_TOKEN
const OVERLAP_SIZE = OVERLAP_TOKENS * CHARS_PER_TOKEN

function chunkText(text: string): string[] {
  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length)
    chunks.push(text.slice(start, end).trim())
    if (end >= text.length) break
    start = end - OVERLAP_SIZE
  }

  return chunks.filter((c) => c.length > 0)
}

export async function indexDocument(
  npcId: string,
  sourceId: string,
  text: string
): Promise<number> {
  // Remove existing embeddings for this source to allow re-indexing
  await db
    .delete(npcEmbeddings)
    .where(
      and(eq(npcEmbeddings.npcId, npcId), eq(npcEmbeddings.sourceId, sourceId))
    )

  const chunks = chunkText(text)
  let indexed = 0

  for (const chunk of chunks) {
    const embedding = await aiGateway.embed(chunk)

    await db.insert(npcEmbeddings).values({
      npcId,
      sourceId,
      chunkText: chunk,
      embedding: embedding as any,
    })
    indexed++
  }

  // Mark source as synced
  await db
    .update(npcKnowledgeSources)
    .set({ lastSyncedAt: new Date() })
    .where(eq(npcKnowledgeSources.id, sourceId))

  return indexed
}

export async function queryKnowledge(
  npcId: string,
  question: string,
  topK = 5
): Promise<string[]> {
  const queryEmbedding = await aiGateway.embed(question)
  const vectorLiteral = sql.raw(`'[${queryEmbedding.join(',')}]'::vector`)

  const results = await db.execute(sql`
    SELECT chunk_text
    FROM npc_embeddings
    WHERE npc_id = ${npcId}
    ORDER BY embedding <=> ${vectorLiteral}
    LIMIT ${topK}
  `)

  return (results.rows as Array<{ chunk_text: string }>).map((r) => r.chunk_text)
}
