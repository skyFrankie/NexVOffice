import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime'
import { config } from '../config'

const NOVA_PRO_MODEL = 'us.amazon.nova-pro-v1:0'
const TITAN_EMBED_MODEL = 'amazon.titan-embed-text-v2:0'
const EMBED_DIMENSIONS = 1024
const RATE_LIMIT_MS = 3000

export interface AIMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AIResponse {
  content: string
  toolUse?: { toolName: string; toolInput: Record<string, unknown> }
}

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

class AIGateway {
  private client: BedrockRuntimeClient
  private lastRequestByUser = new Map<string, number>()
  private concurrencyQueue: Array<() => void> = []
  private activeRequests = 0
  private readonly maxConcurrent = 3
  private readonly queueTimeout = 30000

  constructor() {
    this.client = new BedrockRuntimeClient({
      region: config.awsRegion || 'us-east-1',
    })
  }

  private checkRateLimit(userId: string): boolean {
    const now = Date.now()
    const last = this.lastRequestByUser.get(userId) ?? 0
    if (now - last < RATE_LIMIT_MS) return false
    this.lastRequestByUser.set(userId, now)
    return true
  }

  private acquireConcurrencySlot(): Promise<() => void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('AI request queue timeout'))
      }, this.queueTimeout)

      const tryAcquire = () => {
        if (this.activeRequests < this.maxConcurrent) {
          this.activeRequests++
          clearTimeout(timer)
          const release = () => {
            this.activeRequests--
            const next = this.concurrencyQueue.shift()
            if (next) next()
          }
          resolve(release)
        } else {
          this.concurrencyQueue.push(tryAcquire)
        }
      }

      tryAcquire()
    })
  }

  async chat(
    systemPrompt: string,
    messages: AIMessage[],
    tools?: ToolDefinition[],
    ragContext?: string,
    userId?: string
  ): Promise<AIResponse> {
    if (userId && !this.checkRateLimit(userId)) {
      throw new Error('Rate limit: 1 request per 3 seconds per user')
    }

    const release = await this.acquireConcurrencySlot()
    try {
      const systemContent = ragContext
        ? `${systemPrompt}\n\n## Relevant Knowledge\n${ragContext}`
        : systemPrompt

      const body: Record<string, unknown> = {
        system: [{ text: systemContent }],
        messages: messages.map((m) => ({
          role: m.role,
          content: [{ text: m.content }],
        })),
        inferenceConfig: {
          maxTokens: 1024,
          temperature: 0.7,
        },
      }

      if (tools && tools.length > 0) {
        body.toolConfig = {
          tools: tools.map((t) => ({
            toolSpec: {
              name: t.name,
              description: t.description,
              inputSchema: { json: t.inputSchema },
            },
          })),
        }
      }

      const command = new InvokeModelCommand({
        modelId: NOVA_PRO_MODEL,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(body),
      })

      const response = await this.client.send(command)
      const decoded = JSON.parse(new TextDecoder().decode(response.body))

      const outputContent = decoded.output?.message?.content ?? []
      for (const block of outputContent) {
        if (block.toolUse) {
          return {
            content: '',
            toolUse: {
              toolName: block.toolUse.name,
              toolInput: block.toolUse.input,
            },
          }
        }
        if (block.text) {
          return { content: block.text }
        }
      }

      return { content: '' }
    } finally {
      release()
    }
  }

  async chatStream(
    systemPrompt: string,
    messages: AIMessage[],
    onChunk: (text: string) => void,
    userId?: string
  ): Promise<string> {
    if (userId && !this.checkRateLimit(userId)) {
      throw new Error('Rate limit: 1 request per 3 seconds per user')
    }

    const release = await this.acquireConcurrencySlot()
    try {
      const body = {
        system: [{ text: systemPrompt }],
        messages: messages.map((m) => ({
          role: m.role,
          content: [{ text: m.content }],
        })),
        inferenceConfig: { maxTokens: 1024, temperature: 0.7 },
      }

      const command = new InvokeModelWithResponseStreamCommand({
        modelId: NOVA_PRO_MODEL,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(body),
      })

      const response = await this.client.send(command)
      let fullText = ''

      if (response.body) {
        for await (const event of response.body) {
          if (event.chunk?.bytes) {
            const chunk = JSON.parse(new TextDecoder().decode(event.chunk.bytes))
            const text = chunk.contentBlockDelta?.delta?.text ?? ''
            if (text) {
              fullText += text
              onChunk(text)
            }
          }
        }
      }

      return fullText
    } finally {
      release()
    }
  }

  async embed(text: string): Promise<number[]> {
    const release = await this.acquireConcurrencySlot()
    try {
      const body = {
        inputText: text,
        dimensions: EMBED_DIMENSIONS,
        normalize: true,
      }

      const command = new InvokeModelCommand({
        modelId: TITAN_EMBED_MODEL,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(body),
      })

      const response = await this.client.send(command)
      const decoded = JSON.parse(new TextDecoder().decode(response.body))
      return decoded.embedding as number[]
    } finally {
      release()
    }
  }
}

export const aiGateway = new AIGateway()
