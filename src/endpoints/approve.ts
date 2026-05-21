import type { Endpoint } from 'payload'

import type { ClaudiaWriteOp, ResolvedClaudiaOptions } from '../types'

interface ActionRow {
  id: string | number
  status: string
  op?: ClaudiaWriteOp
  affectedCollection?: string
  toolInput?: { id?: string | number; data?: Record<string, unknown> }
}

/**
 * POST /api/claudia/actions/:id/:decision  (decision = approve | reject)
 * Executes (or discards) a pending preview action recorded by an approval-gated
 * tool. Mutations run as the request's user with overrideAccess:false.
 */
export function buildApproveEndpoint(opts: ResolvedClaudiaOptions): Endpoint {
  return {
    path: '/claudia/actions/:id/:decision',
    method: 'post',
    handler: async (req) => {
      const user = req.user
      if (!user || !opts.access(user)) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const payload = req.payload
      const id = req.routeParams?.id as string | number | undefined
      const decision = req.routeParams?.decision as string | undefined
      if (!id || (decision !== 'approve' && decision !== 'reject')) {
        return Response.json({ error: 'Bad request' }, { status: 400 })
      }

      let action: ActionRow
      try {
        action = (await payload.findByID({
          collection: opts.actionsSlug as never,
          id,
          req,
          overrideAccess: false,
        })) as unknown as ActionRow
      } catch {
        return Response.json({ error: 'Action not found' }, { status: 404 })
      }

      if (action.status !== 'preview') {
        return Response.json({ error: `Action already ${action.status}` }, { status: 409 })
      }

      if (decision === 'reject') {
        await payload.update({
          collection: opts.actionsSlug as never,
          id,
          data: { status: 'failed', errorMessage: 'Rejected by user' } as never,
          req,
          overrideAccess: false,
        })
        return Response.json({ ok: true, status: 'rejected' })
      }

      const { op, affectedCollection, toolInput } = action
      if (!op || !affectedCollection) {
        return Response.json({ error: 'Malformed action' }, { status: 422 })
      }

      try {
        let output: unknown
        if (op === 'create') {
          output = await payload.create({
            collection: affectedCollection as never,
            data: (toolInput?.data ?? {}) as never,
            req,
            overrideAccess: false,
          })
        } else if (op === 'update') {
          output = await payload.update({
            collection: affectedCollection as never,
            id: toolInput!.id!,
            data: (toolInput?.data ?? {}) as never,
            req,
            overrideAccess: false,
          })
        } else {
          await payload.delete({
            collection: affectedCollection as never,
            id: toolInput!.id!,
            req,
            overrideAccess: false,
          })
          output = { deletedId: toolInput!.id }
        }

        await payload.update({
          collection: opts.actionsSlug as never,
          id,
          data: {
            status: 'executed',
            toolOutput: output,
            executedAt: new Date().toISOString(),
          } as never,
          req,
          overrideAccess: false,
        })
        return Response.json({ ok: true, status: 'executed', output })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Execution failed'
        await payload.update({
          collection: opts.actionsSlug as never,
          id,
          data: { status: 'failed', errorMessage: message } as never,
          req,
          overrideAccess: false,
        })
        return Response.json({ error: message }, { status: 500 })
      }
    },
  }
}
