'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, getToolName, isToolUIPart, type UIMessage } from 'ai'
import { Loader2, Send, Sparkles } from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState } from 'react'

import { ApprovalCard } from './ApprovalCard'
import { ToolOutputCard } from './ToolOutputCard'

function newSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `s_${Math.random().toString(36).slice(2)}_${Date.now()}`
}

interface ApprovalResult {
  __claudiaApproval: true
  actionId: string | number
  op: 'create' | 'update' | 'delete'
  collection: string
  summary: string
  riskLevel: 'low' | 'medium' | 'high'
}

function isApprovalResult(value: unknown): value is ApprovalResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { __claudiaApproval?: unknown }).__claudiaApproval === true
  )
}

export function ChatShell({
  label = 'Claudia',
  userLabel = 'admin',
  adminRoute = '/admin',
}: {
  label?: string
  userLabel?: string
  adminRoute?: string
}) {
  const [sessionId] = useState<string>(newSessionId)
  const [input, setInput] = useState('')
  const [errorNotice, setErrorNotice] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, status, stop } = useChat({
    transport: useMemo(() => new DefaultChatTransport({ api: '/api/claudia/chat' }), []),
    onError: (err) => setErrorNotice(err instanceof Error ? err.message : String(err)),
  })

  const isStreaming = status === 'streaming' || status === 'submitted'

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || isStreaming) return
    setErrorNotice(null)
    setInput('')
    void sendMessage({ role: 'user', parts: [{ type: 'text', text }] }, { body: { sessionId } })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 16px',
          borderBottom: '1px solid var(--theme-elevation-150, #e5e5e5)',
        }}
      >
        <Sparkles size={18} />
        <strong>{label}</strong>
        <span style={{ marginLeft: 'auto', opacity: 0.6, fontSize: 13 }}>{userLabel}</span>
      </header>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16, minHeight: 0 }}>
        {messages.length === 0 && (
          <div style={{ opacity: 0.6, textAlign: 'center', marginTop: 40, fontSize: 14 }}>
            Ask {label} to read or change your store data.
          </div>
        )}
        {messages.map((message: UIMessage) => (
          <MessageBubble key={message.id} message={message} adminRoute={adminRoute} />
        ))}
      </div>

      {errorNotice && (
        <div style={{ padding: '8px 16px', color: '#b91c1c', fontSize: 13 }}>{errorNotice}</div>
      )}

      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          gap: 8,
          padding: 12,
          borderTop: '1px solid var(--theme-elevation-150, #e5e5e5)',
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit(e)
            }
          }}
          placeholder={`Message ${label}…`}
          rows={1}
          style={{
            flex: 1,
            resize: 'none',
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid var(--theme-elevation-200, #ccc)',
            background: 'var(--theme-input-bg, #fff)',
            color: 'inherit',
            fontFamily: 'inherit',
            fontSize: 14,
          }}
        />
        {isStreaming ? (
          <button type="button" onClick={() => stop()} style={iconBtn} aria-label="Stop">
            <Loader2 size={18} className="animate-spin" />
          </button>
        ) : (
          <button type="submit" style={iconBtn} aria-label="Send" disabled={!input.trim()}>
            <Send size={18} />
          </button>
        )}
      </form>
    </div>
  )
}

function MessageBubble({ message, adminRoute }: { message: UIMessage; adminRoute: string }) {
  const isUser = message.role === 'user'
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', margin: '8px 0' }}>
      <div
        style={{
          maxWidth: '80%',
          padding: isUser ? '8px 12px' : 0,
          borderRadius: 12,
          background: isUser ? 'var(--theme-elevation-100, #efefef)' : 'transparent',
          fontSize: 14,
          lineHeight: 1.5,
        }}
      >
        {message.parts.map((part, i) => {
          if (part.type === 'text') {
            return (
              <div key={i} style={{ whiteSpace: 'pre-wrap' }}>
                {part.text}
              </div>
            )
          }
          if (isToolUIPart(part)) {
            const toolName = getToolName(part)
            const output = part.state === 'output-available' ? part.output : undefined
            if (isApprovalResult(output)) {
              return <ApprovalCard key={i} result={output} adminRoute={adminRoute} />
            }
            return (
              <ToolOutputCard
                key={i}
                toolName={toolName}
                state={part.state}
                input={part.input}
                output={output}
              />
            )
          }
          return null
        })}
      </div>
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 40,
  height: 40,
  borderRadius: 8,
  border: 'none',
  background: 'var(--theme-success-500, #2563eb)',
  color: '#fff',
  cursor: 'pointer',
}

export default ChatShell
