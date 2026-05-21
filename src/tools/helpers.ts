import type { Payload, PayloadRequest } from 'payload'

import type { ClaudiaCollectionRule, ClaudiaUser, ClaudiaWriteOp } from '../types'

/** Apply a rule's field include/exclude list to a document (read direction). */
export function scrubDoc(
  doc: Record<string, unknown>,
  rule: ClaudiaCollectionRule,
): Record<string, unknown> {
  const fields = rule.fields
  if (!fields) return doc
  if (fields.include?.length) {
    const out: Record<string, unknown> = {}
    for (const key of ['id', ...fields.include]) {
      if (key in doc) out[key] = doc[key]
    }
    return out
  }
  if (fields.exclude?.length) {
    const out = { ...doc }
    for (const key of fields.exclude) delete out[key]
    return out
  }
  return doc
}

/** Filter an incoming write payload to the rule's allowed fields (write direction). */
export function filterWriteData(
  data: Record<string, unknown>,
  rule: ClaudiaCollectionRule,
): Record<string, unknown> {
  const fields = rule.fields
  if (!fields) return data
  if (fields.include?.length) {
    const allowed = new Set(fields.include)
    return Object.fromEntries(Object.entries(data).filter(([k]) => allowed.has(k)))
  }
  if (fields.exclude?.length) {
    const denied = new Set(fields.exclude)
    return Object.fromEntries(Object.entries(data).filter(([k]) => !denied.has(k)))
  }
  return data
}

/** A coarse risk heuristic for the approval card. */
export function riskFor(op: ClaudiaWriteOp): 'low' | 'medium' | 'high' {
  if (op === 'delete') return 'high'
  if (op === 'create') return 'low'
  return 'medium'
}

/** Write a row to the audit ledger. Never throws — auditing must not break a tool. */
export async function recordAction(
  payload: Payload,
  actionsSlug: string,
  data: Record<string, unknown>,
  req: PayloadRequest,
): Promise<{ id: string | number } | null> {
  try {
    const doc = await payload.create({
      collection: actionsSlug as never,
      data: data as never,
      req,
      overrideAccess: false,
    })
    return { id: (doc as { id: string | number }).id }
  } catch (err) {
    payload.logger.error({ msg: '[claudia] failed to record action', err })
    return null
  }
}

export function actorId(user: ClaudiaUser): string | number | undefined {
  if (user && typeof user === 'object' && 'id' in user) {
    return (user as { id: string | number }).id
  }
  return undefined
}
