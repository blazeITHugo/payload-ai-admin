import type { CollectionConfig, CollectionSlug } from 'payload'

import type { ClaudiaUser } from '../types'

/**
 * Audit ledger for everything the AI does. Direct (non-approval) writes record a
 * single `executed`/`failed` row. Approval-gated writes record a `preview` row
 * first; on approval the row is updated to `executed` (or a paired row written).
 *
 * Read = privileged only (it's a security trail). Create = any authenticated
 * principal, because the system writes rows in the request's user context.
 */
export function buildActionsCollection(args: {
  slug: string
  usersSlug: string
  label: string
  isPrivileged: (user: ClaudiaUser) => boolean
}): CollectionConfig {
  const { slug, usersSlug, label, isPrivileged } = args

  return {
    slug,
    labels: {
      singular: `${label} Action`,
      plural: `${label} Actions`,
    },
    admin: {
      group: label,
      useAsTitle: 'toolName',
      defaultColumns: ['toolName', 'status', 'affectedCollection', 'affectedDocId', 'createdAt'],
    },
    access: {
      read: ({ req: { user } }) => Boolean(user) && isPrivileged(user),
      create: ({ req: { user } }) => Boolean(user),
      update: ({ req: { user } }) => Boolean(user) && isPrivileged(user),
      delete: ({ req: { user } }) => Boolean(user) && isPrivileged(user),
    },
    fields: [
      { name: 'actor', type: 'relationship', relationTo: usersSlug as CollectionSlug, index: true },
      { name: 'toolName', type: 'text', required: true, index: true },
      {
        name: 'status',
        type: 'select',
        required: true,
        defaultValue: 'preview',
        index: true,
        options: [
          { label: 'Preview', value: 'preview' },
          { label: 'Executed', value: 'executed' },
          { label: 'Failed', value: 'failed' },
          { label: 'Reverted', value: 'reverted' },
        ],
      },
      { name: 'op', type: 'text' },
      { name: 'affectedCollection', type: 'text', index: true },
      { name: 'affectedDocId', type: 'text', index: true },
      {
        name: 'requestId',
        type: 'text',
        index: true,
        admin: { description: 'AI SDK toolCallId — pairs preview with execution.' },
      },
      { name: 'sessionId', type: 'text', index: true },
      { name: 'toolInput', type: 'json' },
      {
        name: 'previewSnapshot',
        type: 'json',
        admin: { description: 'Before-state + proposed change + riskLevel.' },
      },
      { name: 'toolOutput', type: 'json' },
      { name: 'errorMessage', type: 'textarea' },
      { name: 'executedAt', type: 'date', index: true },
    ],
  }
}
