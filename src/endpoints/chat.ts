import { createAgentUIStreamResponse } from 'ai'
import type { Endpoint, PayloadRequest } from 'payload'

import { buildClaudiaAgent } from '../agent/buildAgent'
import { actorId } from '../tools/helpers'
import type { ResolvedClaudiaOptions } from '../types'

interface ChatBody {
  messages?: unknown[]
  sessionId?: string
}

async function readJson(req: PayloadRequest): Promise<ChatBody> {
  try {
    if (typeof req.json === 'function') return (await req.json()) as ChatBody
  } catch {
    /* fall through */
  }
  return (req.data as ChatBody) ?? {}
}

function deriveTitle(messages: unknown[]): string | undefined {
  for (const m of messages) {
    const msg = m as { role?: string; parts?: Array<{ type?: string; text?: string }> }
    if (msg.role !== 'user') continue
    const text = msg.parts?.find((p) => p.type === 'text')?.text
    if (text) return text.slice(0, 80)
  }
  return undefined
}

/** POST /api/claudia/chat — run the agent and stream the response. */
export function buildChatEndpoint(opts: ResolvedClaudiaOptions): Endpoint {
  return {
    path: '/claudia/chat',
    method: 'post',
    handler: async (req) => {
      const user = req.user
      if (!user || !opts.access(user)) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const { messages = [], sessionId } = await readJson(req)
      const payload = req.payload

      const agent = buildClaudiaAgent({
        model: opts.model,
        maxSteps: opts.maxSteps,
        ctx: { req, payload, user },
        collections: opts.collections,
        actionsSlug: opts.actionsSlug,
        sessionId,
        customTools: opts.tools,
        instructions: opts.instructions,
        siteName: opts.siteName,
      })

      return createAgentUIStreamResponse({
        agent,
        uiMessages: messages,
        originalMessages: messages as never,
        onError: (error) => (error instanceof Error ? error.message : String(error)),
        onFinish: async ({ messages: finalMessages }) => {
          if (!sessionId) return
          try {
            const existing = await payload.find({
              collection: opts.conversationsSlug as never,
              where: { sessionId: { equals: sessionId } },
              limit: 1,
              req,
              overrideAccess: false,
            })
            const data = {
              sessionId,
              user: actorId(user),
              messages: finalMessages,
              messageCount: finalMessages.length,
              title: deriveTitle(finalMessages),
            }
            if (existing.docs[0]) {
              await payload.update({
                collection: opts.conversationsSlug as never,
                id: (existing.docs[0] as { id: string | number }).id,
                data: data as never,
                req,
                overrideAccess: false,
              })
            } else {
              await payload.create({
                collection: opts.conversationsSlug as never,
                data: data as never,
                req,
                overrideAccess: false,
              })
            }
          } catch (err) {
            payload.logger.error({ msg: '[claudia] failed to persist conversation', err })
          }
        },
      })
    },
  }
}
