import type { AdminViewServerProps } from 'payload'
import React from 'react'

import { ChatShell } from './ChatShell'

type ChatViewProps = AdminViewServerProps & { label?: string }

/**
 * Root admin view for the Claudia chat. The admin is already authenticated by
 * Payload, so the user is available on initPageResult — no login UI needed.
 */
export function ChatView(props: ChatViewProps) {
  const user = props.initPageResult?.req?.user as { name?: string; email?: string } | null
  const label = props.label ?? 'Claudia'
  const userLabel = user?.name || user?.email || 'admin'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - var(--app-header-height, 0px))',
        minHeight: '70vh',
      }}
    >
      <ChatShell label={label} userLabel={userLabel} adminRoute="/admin" />
    </div>
  )
}

export default ChatView
