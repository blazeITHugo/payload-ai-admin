import type { Config } from 'payload'

import { buildActionsCollection } from './collections/actions'
import { buildConversationsCollection } from './collections/conversations'
import {
  DEFAULT_ACTIONS_SLUG,
  DEFAULT_CONVERSATIONS_SLUG,
  DEFAULT_LABEL,
  DEFAULT_MAX_STEPS,
  DEFAULT_MODEL,
  USERS_SLUG,
} from './defaults'
import { buildApproveEndpoint } from './endpoints/approve'
import { buildChatEndpoint } from './endpoints/chat'
import type { ClaudiaPluginOptions, ClaudiaUser, ResolvedClaudiaOptions } from './types'

export type {
  ClaudiaCollectionRule,
  ClaudiaPluginOptions,
  ClaudiaToolContext,
  ClaudiaUser,
} from './types'

/**
 * Claudia — an embedded, config-driven AI control panel for Payload.
 *
 * The consumer declares which collections/fields/ops the AI may touch; the
 * plugin adds an audit ledger, a conversation store, a streaming chat endpoint,
 * and an admin chat view. Every mutation runs through Payload access control as
 * the logged-in user, so the AI can never exceed that user's own permissions.
 */
export const claudiaPlugin =
  (options: ClaudiaPluginOptions) =>
  (incomingConfig: Config): Config => {
    if (options.enabled === false) return incomingConfig

    const access = options.access ?? ((user: ClaudiaUser) => Boolean(user))
    const resolved: ResolvedClaudiaOptions = {
      enabled: true,
      model: options.model ?? DEFAULT_MODEL,
      collections: options.collections,
      access,
      conversationsSlug: options.conversationsSlug ?? DEFAULT_CONVERSATIONS_SLUG,
      actionsSlug: options.actionsSlug ?? DEFAULT_ACTIONS_SLUG,
      maxSteps: options.maxSteps ?? DEFAULT_MAX_STEPS,
      label: options.label ?? DEFAULT_LABEL,
      tools: options.tools,
      instructions: options.instructions,
      siteName: options.siteName,
    }

    const config = { ...incomingConfig }

    // --- collections ------------------------------------------------------
    config.collections = [
      ...(config.collections ?? []),
      buildConversationsCollection({
        slug: resolved.conversationsSlug,
        usersSlug: USERS_SLUG,
        label: resolved.label,
        isPrivileged: access,
      }),
      buildActionsCollection({
        slug: resolved.actionsSlug,
        usersSlug: USERS_SLUG,
        label: resolved.label,
        isPrivileged: access,
      }),
    ]

    // --- endpoints --------------------------------------------------------
    config.endpoints = [
      ...(config.endpoints ?? []),
      buildChatEndpoint(resolved),
      buildApproveEndpoint(resolved),
    ]

    // --- admin view + nav link -------------------------------------------
    config.admin = config.admin ?? {}
    config.admin.components = config.admin.components ?? {}
    config.admin.components.views = {
      ...(config.admin.components.views ?? {}),
      claudia: {
        Component: {
          path: 'payload-ai-admin/rsc#ChatView',
          serverProps: { label: resolved.label },
        },
        path: '/claudia',
      },
    }
    config.admin.components.afterNavLinks = [
      ...(config.admin.components.afterNavLinks ?? []),
      {
        path: 'payload-ai-admin/client#ClaudiaNavLink',
        clientProps: { label: resolved.label },
      },
    ]

    return config
  }

/** Alias matching the package name. Identical to {@link claudiaPlugin}. */
export const payloadAiAdmin = claudiaPlugin

export default claudiaPlugin
