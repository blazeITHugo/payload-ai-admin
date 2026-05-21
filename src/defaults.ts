import { anthropic } from '@ai-sdk/anthropic'
import type { LanguageModel } from 'ai'

/**
 * Default model. The Anthropic provider reads ANTHROPIC_API_KEY lazily at call
 * time, so constructing this at module load is safe even without the key set.
 */
export const DEFAULT_MODEL: LanguageModel = anthropic('claude-sonnet-4-6')

export const DEFAULT_CONVERSATIONS_SLUG = 'claudia-conversations'
export const DEFAULT_ACTIONS_SLUG = 'claudia-actions'
export const DEFAULT_MAX_STEPS = 6
export const DEFAULT_LABEL = 'Claudia'

/** The collection holding admin users — Payload's auth collection. */
export const USERS_SLUG = 'users'
