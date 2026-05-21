import type { PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { createGenericTools } from '../src/tools/generic'
import { filterWriteData, riskFor, scrubDoc } from '../src/tools/helpers'
import type { ClaudiaCollectionRule } from '../src/types'

const collections: Record<string, ClaudiaCollectionRule> = {
  orders: { read: true, update: true, approval: ['update'] },
  products: { read: true, create: true },
}

type ToolWithExecute = {
  execute: (input: unknown, opts: { toolCallId: string }) => Promise<Record<string, unknown>>
}

function makePayload() {
  return {
    find: vi.fn().mockResolvedValue({ totalDocs: 1, docs: [{ id: 1, total: 99, secret: 'x' }] }),
    findByID: vi.fn().mockResolvedValue({ id: 1, status: 'processing' }),
    create: vi.fn().mockResolvedValue({ id: 'action-1' }),
    update: vi.fn().mockResolvedValue({ id: 1, status: 'cancelled' }),
    delete: vi.fn().mockResolvedValue({ id: 1 }),
    count: vi.fn().mockResolvedValue({ totalDocs: 5 }),
    logger: { error: vi.fn() },
  }
}

function build(payload: ReturnType<typeof makePayload>) {
  const ctx = {
    req: {} as PayloadRequest,
    payload: payload as unknown as PayloadRequest['payload'],
    user: { id: 7, roles: ['admin'] } as unknown as PayloadRequest['user'],
  }
  return createGenericTools({ ctx, collections, actionsSlug: 'claudia-actions', sessionId: 's1' })
}

describe('helpers', () => {
  it('scrubDoc excludes listed fields', () => {
    expect(scrubDoc({ id: 1, total: 99, secret: 'x' }, { fields: { exclude: ['secret'] } })).toEqual({
      id: 1,
      total: 99,
    })
  })

  it('scrubDoc include keeps id + listed only', () => {
    expect(scrubDoc({ id: 1, total: 99, secret: 'x' }, { fields: { include: ['total'] } })).toEqual({
      id: 1,
      total: 99,
    })
  })

  it('filterWriteData drops excluded keys', () => {
    expect(filterWriteData({ a: 1, b: 2 }, { fields: { exclude: ['b'] } })).toEqual({ a: 1 })
  })

  it('riskFor maps ops to risk', () => {
    expect(riskFor('delete')).toBe('high')
    expect(riskFor('update')).toBe('medium')
    expect(riskFor('create')).toBe('low')
  })
})

describe('generic tools', () => {
  it('only generates tools for allowed ops (no delete)', () => {
    const tools = build(makePayload())
    expect(Object.keys(tools)).toContain('queryCollection')
    expect(Object.keys(tools)).toContain('createDocument')
    expect(Object.keys(tools)).toContain('updateDocument')
    expect(Object.keys(tools)).not.toContain('deleteDocument')
  })

  it('refuses reads on a collection not in the allowlist', async () => {
    const payload = makePayload()
    const tools = build(payload)
    const res = await (tools.queryCollection as unknown as ToolWithExecute).execute(
      { collection: 'users', limit: 10, depth: 1 },
      { toolCallId: 'tc1' },
    )
    expect(res.error).toMatch(/not allowed/)
    expect(payload.find).not.toHaveBeenCalled()
  })

  it('reads an allowed collection through the Local API', async () => {
    const payload = makePayload()
    const tools = build(payload)
    const res = await (tools.queryCollection as unknown as ToolWithExecute).execute(
      { collection: 'orders', limit: 10, depth: 1 },
      { toolCallId: 'tc2' },
    )
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'orders', overrideAccess: false }),
    )
    expect((res as { total: number }).total).toBe(1)
  })

  it('queues an approval-gated update instead of mutating', async () => {
    const payload = makePayload()
    const tools = build(payload)
    const res = await (tools.updateDocument as unknown as ToolWithExecute).execute(
      { collection: 'orders', id: 1, data: { status: 'cancelled' } },
      { toolCallId: 'tc3' },
    )
    expect((res as { __claudiaApproval?: boolean }).__claudiaApproval).toBe(true)
    expect(payload.update).not.toHaveBeenCalled()
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'claudia-actions' }),
    )
  })

  it('executes a non-approval create and records an executed action', async () => {
    const payload = makePayload()
    payload.create.mockResolvedValueOnce({ id: 42 }).mockResolvedValueOnce({ id: 'action-2' })
    const tools = build(payload)
    const res = await (tools.createDocument as unknown as ToolWithExecute).execute(
      { collection: 'products', data: { title: 'New' } },
      { toolCallId: 'tc4' },
    )
    expect((res as { ok?: boolean }).ok).toBe(true)
    expect(payload.create).toHaveBeenCalledTimes(2)
    expect(payload.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        collection: 'claudia-actions',
        data: expect.objectContaining({ status: 'executed' }),
      }),
    )
  })
})
