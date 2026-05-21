'use client'

import { ChevronDown, ChevronRight, Wrench } from 'lucide-react'
import React, { useState } from 'react'

interface ToolOutputCardProps {
  toolName: string
  state: string
  input?: unknown
  output?: unknown
}

/** Collapsible card showing a tool call's input/output. */
export function ToolOutputCard({ toolName, state, input, output }: ToolOutputCardProps) {
  const [open, setOpen] = useState(false)
  const running = state === 'input-streaming' || state === 'input-available'

  return (
    <div
      style={{
        border: '1px solid var(--theme-elevation-150, #e0e0e0)',
        borderRadius: 8,
        padding: '8px 10px',
        margin: '6px 0',
        fontSize: 13,
        background: 'var(--theme-elevation-50, #fafafa)',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'inherit',
          padding: 0,
        }}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Wrench size={14} />
        <span style={{ fontWeight: 600 }}>{toolName}</span>
        <span style={{ opacity: 0.6, marginLeft: 'auto' }}>{running ? 'running…' : state}</span>
      </button>
      {open && (
        <div style={{ marginTop: 8 }}>
          {input != null && (
            <pre style={preStyle}>
              <strong>input</strong>
              {'\n'}
              {safeStringify(input)}
            </pre>
          )}
          {output != null && (
            <pre style={preStyle}>
              <strong>output</strong>
              {'\n'}
              {safeStringify(output)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

const preStyle: React.CSSProperties = {
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontSize: 12,
  margin: '4px 0',
  maxHeight: 240,
  overflow: 'auto',
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export default ToolOutputCard
