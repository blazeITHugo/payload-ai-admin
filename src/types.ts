import type { LanguageModel, Tool } from 'ai'
import type { PayloadRequest } from 'payload'

/** The authenticated principal, as Payload resolves it on a request. */
export type ClaudiaUser = PayloadRequest['user']

export type ClaudiaWriteOp = 'create' | 'update' | 'delete'

/**
 * Per-collection capability declaration. This is the headline knob: it decides
 * exactly what the AI may read / create / update / delete, plus which writes
 * must be confirmed by a human before they run.
 *
 * Note: this is a *narrowing* layer. Every tool also runs through Payload access
 * control as the logged-in user (overrideAccess: false), so the AI can never
 * exceed what that user could do by hand — this config can only restrict further.
 */
export interface ClaudiaCollectionRule {
  read?: boolean
  create?: boolean
  update?: boolean
  delete?: boolean
  /** Field-level scoping applied on read (strip) and write (filter). */
  fields?: { include?: string[]; exclude?: string[] }
  /** Write ops that require explicit human approval before execution. */
  approval?: ClaudiaWriteOp[]
}

/** Context handed to every tool execution (generic + custom). */
export interface ClaudiaToolContext {
  req: PayloadRequest
  payload: PayloadRequest['payload']
  user: ClaudiaUser
}

/** Context available when building the system prompt. */
export interface ClaudiaInstructionContext {
  user: ClaudiaUser
  collections: Record<string, ClaudiaCollectionRule>
  /** Human-readable site/app name, if the consumer supplied one. */
  siteName?: string
}

export interface ClaudiaPluginOptions {
  /** Disable the plugin without uninstalling it. @default true */
  enabled?: boolean
  /** Any AI SDK v6 language model. @default anthropic('claude-sonnet-4-6') */
  model?: LanguageModel
  /** The capability map — which collections/ops/fields the AI may touch. */
  collections: Record<string, ClaudiaCollectionRule>
  /** Who may use the chat. @default any authenticated user */
  access?: (user: ClaudiaUser) => boolean
  /** Register custom domain tools beyond the generic CRUD set. */
  tools?: (ctx: ClaudiaToolContext) => Record<string, Tool>
  /** Override or extend the system prompt. */
  instructions?: string | ((ctx: ClaudiaInstructionContext) => string)
  /** Collection slug for chat history. @default 'claudia-conversations' */
  conversationsSlug?: string
  /** Collection slug for the audit ledger. @default 'claudia-actions' */
  actionsSlug?: string
  /** Max agent loop steps. @default 6 */
  maxSteps?: number
  /** Nav-item / view label. @default 'Claudia' */
  label?: string
  /** Display name passed into the system prompt. */
  siteName?: string
}

/** Resolved options with defaults applied — used internally. */
export interface ResolvedClaudiaOptions extends Required<Omit<ClaudiaPluginOptions, 'tools' | 'instructions' | 'model' | 'siteName'>> {
  model: LanguageModel
  tools?: ClaudiaPluginOptions['tools']
  instructions?: ClaudiaPluginOptions['instructions']
  siteName?: string
}

/** Shape returned by an approval-gated tool so the UI renders an ApprovalCard. */
export interface ClaudiaApprovalResult {
  __claudiaApproval: true
  actionId: string | number
  op: ClaudiaWriteOp
  collection: string
  summary: string
  riskLevel: 'low' | 'medium' | 'high'
}
