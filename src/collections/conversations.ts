import type { CollectionConfig, CollectionSlug } from 'payload'

import type { ClaudiaUser } from '../types'

/**
 * Chat history. A user always sees their own conversations; a privileged user
 * (per the plugin's `access` predicate) sees everyone's.
 */
export function buildConversationsCollection(args: {
  slug: string
  usersSlug: string
  label: string
  isPrivileged: (user: ClaudiaUser) => boolean
}): CollectionConfig {
  const { slug, usersSlug, label, isPrivileged } = args

  return {
    slug,
    labels: {
      singular: `${label} Conversation`,
      plural: `${label} Conversations`,
    },
    admin: {
      group: label,
      useAsTitle: 'title',
      defaultColumns: ['title', 'user', 'messageCount', 'updatedAt'],
    },
    access: {
      read: ({ req: { user } }) => {
        if (!user) return false
        if (isPrivileged(user)) return true
        return { user: { equals: user.id } }
      },
      create: ({ req: { user } }) => Boolean(user),
      update: ({ req: { user } }) => {
        if (!user) return false
        if (isPrivileged(user)) return true
        return { user: { equals: user.id } }
      },
      delete: ({ req: { user } }) => {
        if (!user) return false
        if (isPrivileged(user)) return true
        return { user: { equals: user.id } }
      },
    },
    fields: [
      { name: 'title', type: 'text' },
      { name: 'sessionId', type: 'text', required: true, index: true },
      {
        name: 'user',
        type: 'relationship',
        relationTo: usersSlug as CollectionSlug,
        index: true,
        admin: { readOnly: true },
      },
      { name: 'messages', type: 'json' },
      { name: 'messageCount', type: 'number', defaultValue: 0 },
    ],
  }
}
