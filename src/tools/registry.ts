import type { Tool } from 'ai'

import type { ClaudiaCollectionRule, ClaudiaPluginOptions, ClaudiaToolContext } from '../types'
import { createGenericTools } from './generic'

/** Merge the auto-generated generic tools with any consumer-registered tools. */
export function buildToolSet(args: {
  ctx: ClaudiaToolContext
  collections: Record<string, ClaudiaCollectionRule>
  actionsSlug: string
  sessionId?: string
  customTools?: ClaudiaPluginOptions['tools']
}): Record<string, Tool> {
  const { ctx, collections, actionsSlug, sessionId, customTools } = args
  const generic = createGenericTools({ ctx, collections, actionsSlug, sessionId })
  const custom = customTools ? customTools(ctx) : {}
  // Custom tools win on name collision, so consumers can override generics.
  return { ...generic, ...custom }
}
