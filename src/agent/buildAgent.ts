import { ToolLoopAgent, stepCountIs } from 'ai'

import type {
  ClaudiaCollectionRule,
  ClaudiaInstructionContext,
  ClaudiaPluginOptions,
  ClaudiaToolContext,
} from '../types'
import { buildToolSet } from '../tools/registry'
import { buildInstructions } from './instructions'

/**
 * Assemble a per-request ToolLoopAgent. Tools and instructions are concrete
 * (built from the live request context), so no callOptionsSchema/prepareCall
 * indirection is needed.
 */
export function buildClaudiaAgent(args: {
  model: ClaudiaPluginOptions['model']
  maxSteps: number
  ctx: ClaudiaToolContext
  collections: Record<string, ClaudiaCollectionRule>
  actionsSlug: string
  sessionId?: string
  customTools?: ClaudiaPluginOptions['tools']
  instructions?: ClaudiaPluginOptions['instructions']
  siteName?: string
}) {
  const {
    model,
    maxSteps,
    ctx,
    collections,
    actionsSlug,
    sessionId,
    customTools,
    instructions,
    siteName,
  } = args

  const instructionCtx: ClaudiaInstructionContext = { user: ctx.user, collections, siteName }
  const resolvedInstructions =
    typeof instructions === 'function'
      ? instructions(instructionCtx)
      : (instructions ?? buildInstructions(instructionCtx))

  const tools = buildToolSet({ ctx, collections, actionsSlug, sessionId, customTools })

  return new ToolLoopAgent({
    model: model!,
    instructions: resolvedInstructions,
    tools,
    stopWhen: stepCountIs(maxSteps),
  })
}
