import { tool, type Tool } from 'ai'
import type { Where } from 'payload'
import { z } from 'zod'

import type {
  ClaudiaApprovalResult,
  ClaudiaCollectionRule,
  ClaudiaToolContext,
  ClaudiaWriteOp,
} from '../types'
import { actorId, filterWriteData, recordAction, riskFor, scrubDoc } from './helpers'

const idSchema = z.union([z.string(), z.number()])

function ruleAllows(rule: ClaudiaCollectionRule | undefined, op: 'read' | ClaudiaWriteOp): boolean {
  return Boolean(rule && rule[op])
}

function needsApproval(rule: ClaudiaCollectionRule | undefined, op: ClaudiaWriteOp): boolean {
  return Boolean(rule?.approval?.includes(op))
}

/**
 * Build the generic CRUD toolset from the capability map. Every call runs through
 * Payload's Local API with the request's user and `overrideAccess: false`, so
 * access control is enforced twice: by this allowlist and by Payload itself.
 */
export function createGenericTools(args: {
  ctx: ClaudiaToolContext
  collections: Record<string, ClaudiaCollectionRule>
  actionsSlug: string
  sessionId?: string
}): Record<string, Tool> {
  const { ctx, collections, actionsSlug, sessionId } = args
  const { payload, req, user } = ctx

  const readable = Object.keys(collections).filter((s) => collections[s]?.read)
  const writable = (op: ClaudiaWriteOp) =>
    Object.keys(collections).filter((s) => collections[s]?.[op])

  const tools: Record<string, Tool> = {}

  // ---- reads -------------------------------------------------------------
  tools.queryCollection = tool({
    description: `Query documents from an allowed collection. Allowed for reading: ${readable.join(', ') || '(none)'}.`,
    inputSchema: z.object({
      collection: z.string().describe('Collection slug to read from.'),
      where: z
        .record(z.string(), z.any())
        .optional()
        .describe('Payload "where" query object, e.g. { status: { equals: "completed" } }.'),
      limit: z.number().min(1).max(50).default(10),
      depth: z.number().min(0).max(2).default(1),
    }),
    execute: async ({ collection, where, limit, depth }) => {
      const rule = collections[collection]
      if (!ruleAllows(rule, 'read')) return { error: `Reading '${collection}' is not allowed.` }
      const res = await payload.find({
        collection: collection as never,
        where: (where as Where) ?? undefined,
        limit,
        depth,
        req,
        overrideAccess: false,
      })
      return {
        total: res.totalDocs,
        docs: res.docs.map((d) => scrubDoc(d as Record<string, unknown>, rule!)),
      }
    },
  })

  tools.getDocument = tool({
    description: 'Fetch a single document by id from an allowed collection.',
    inputSchema: z.object({
      collection: z.string(),
      id: idSchema,
      depth: z.number().min(0).max(2).default(1),
    }),
    execute: async ({ collection, id, depth }) => {
      const rule = collections[collection]
      if (!ruleAllows(rule, 'read')) return { error: `Reading '${collection}' is not allowed.` }
      try {
        const doc = await payload.findByID({
          collection: collection as never,
          id,
          depth,
          req,
          overrideAccess: false,
        })
        return scrubDoc(doc as Record<string, unknown>, rule!)
      } catch {
        return { error: `Document ${String(id)} not found in '${collection}'.` }
      }
    },
  })

  tools.countDocuments = tool({
    description: 'Count documents in an allowed collection, optionally filtered.',
    inputSchema: z.object({
      collection: z.string(),
      where: z.record(z.string(), z.any()).optional(),
    }),
    execute: async ({ collection, where }) => {
      const rule = collections[collection]
      if (!ruleAllows(rule, 'read')) return { error: `Reading '${collection}' is not allowed.` }
      const res = await payload.count({
        collection: collection as never,
        where: (where as Where) ?? undefined,
        req,
        overrideAccess: false,
      })
      return { count: res.totalDocs }
    },
  })

  // ---- writes ------------------------------------------------------------
  const writePreview = async (
    op: ClaudiaWriteOp,
    collection: string,
    toolCallId: string,
    toolInput: Record<string, unknown>,
    affectedDocId?: string | number,
    before?: unknown,
  ): Promise<ClaudiaApprovalResult> => {
    const summary =
      op === 'create'
        ? `Create a new ${collection} document.`
        : op === 'update'
          ? `Update ${collection} #${String(affectedDocId)}.`
          : `Delete ${collection} #${String(affectedDocId)}.`
    const riskLevel = riskFor(op)
    const action = await recordAction(
      payload,
      actionsSlug,
      {
        actor: actorId(user),
        toolName: `${op}Document`,
        status: 'preview',
        op,
        affectedCollection: collection,
        affectedDocId: affectedDocId != null ? String(affectedDocId) : undefined,
        requestId: toolCallId,
        sessionId,
        toolInput,
        previewSnapshot: { summary, riskLevel, before },
      },
      req,
    )
    return {
      __claudiaApproval: true,
      actionId: action?.id ?? toolCallId,
      op,
      collection,
      summary,
      riskLevel,
    }
  }

  if (writable('create').length) {
    tools.createDocument = tool({
      description: `Create a document. Allowed for creating: ${writable('create').join(', ')}.`,
      inputSchema: z.object({
        collection: z.string(),
        data: z.record(z.string(), z.any()).describe('Field values for the new document.'),
      }),
      execute: async ({ collection, data }, { toolCallId }) => {
        const rule = collections[collection]
        if (!ruleAllows(rule, 'create')) return { error: `Creating in '${collection}' is not allowed.` }
        const clean = filterWriteData(data as Record<string, unknown>, rule!)
        if (needsApproval(rule, 'create')) {
          return writePreview('create', collection, toolCallId, { data: clean })
        }
        try {
          const doc = await payload.create({
            collection: collection as never,
            data: clean as never,
            req,
            overrideAccess: false,
          })
          await recordAction(
            payload,
            actionsSlug,
            {
              actor: actorId(user),
              toolName: 'createDocument',
              status: 'executed',
              op: 'create',
              affectedCollection: collection,
              affectedDocId: String((doc as { id: string | number }).id),
              requestId: toolCallId,
              sessionId,
              toolInput: { data: clean },
              toolOutput: doc,
              executedAt: new Date().toISOString(),
            },
            req,
          )
          return { ok: true, document: scrubDoc(doc as Record<string, unknown>, rule!) }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Create failed.' }
        }
      },
    })
  }

  if (writable('update').length) {
    tools.updateDocument = tool({
      description: `Update a document by id. Allowed for updating: ${writable('update').join(', ')}.`,
      inputSchema: z.object({
        collection: z.string(),
        id: idSchema,
        data: z.record(z.string(), z.any()).describe('Fields to change.'),
      }),
      execute: async ({ collection, id, data }, { toolCallId }) => {
        const rule = collections[collection]
        if (!ruleAllows(rule, 'update')) return { error: `Updating '${collection}' is not allowed.` }
        const clean = filterWriteData(data as Record<string, unknown>, rule!)
        if (needsApproval(rule, 'update')) {
          let before: unknown
          try {
            before = await payload.findByID({
              collection: collection as never,
              id,
              depth: 0,
              req,
              overrideAccess: false,
            })
          } catch {
            return { error: `Document ${String(id)} not found in '${collection}'.` }
          }
          return writePreview('update', collection, toolCallId, { id, data: clean }, id, before)
        }
        try {
          const doc = await payload.update({
            collection: collection as never,
            id,
            data: clean as never,
            req,
            overrideAccess: false,
          })
          await recordAction(
            payload,
            actionsSlug,
            {
              actor: actorId(user),
              toolName: 'updateDocument',
              status: 'executed',
              op: 'update',
              affectedCollection: collection,
              affectedDocId: String(id),
              requestId: toolCallId,
              sessionId,
              toolInput: { id, data: clean },
              toolOutput: doc,
              executedAt: new Date().toISOString(),
            },
            req,
          )
          return { ok: true, document: scrubDoc(doc as Record<string, unknown>, rule!) }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Update failed.' }
        }
      },
    })
  }

  if (writable('delete').length) {
    tools.deleteDocument = tool({
      description: `Delete a document by id. Allowed for deleting: ${writable('delete').join(', ')}.`,
      inputSchema: z.object({
        collection: z.string(),
        id: idSchema,
      }),
      execute: async ({ collection, id }, { toolCallId }) => {
        const rule = collections[collection]
        if (!ruleAllows(rule, 'delete')) return { error: `Deleting '${collection}' is not allowed.` }
        if (needsApproval(rule, 'delete')) {
          let before: unknown
          try {
            before = await payload.findByID({
              collection: collection as never,
              id,
              depth: 0,
              req,
              overrideAccess: false,
            })
          } catch {
            return { error: `Document ${String(id)} not found in '${collection}'.` }
          }
          return writePreview('delete', collection, toolCallId, { id }, id, before)
        }
        try {
          await payload.delete({
            collection: collection as never,
            id,
            req,
            overrideAccess: false,
          })
          await recordAction(
            payload,
            actionsSlug,
            {
              actor: actorId(user),
              toolName: 'deleteDocument',
              status: 'executed',
              op: 'delete',
              affectedCollection: collection,
              affectedDocId: String(id),
              requestId: toolCallId,
              sessionId,
              toolInput: { id },
              executedAt: new Date().toISOString(),
            },
            req,
          )
          return { ok: true, deletedId: id }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Delete failed.' }
        }
      },
    })
  }

  return tools
}
