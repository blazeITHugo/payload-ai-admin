'use client'

import { AlertTriangle, Check, X } from 'lucide-react'
import React, { useState } from 'react'

interface ApprovalResult {
  __claudiaApproval: true
  actionId: string | number
  op: 'create' | 'update' | 'delete'
  collection: string
  summary: string
  riskLevel: 'low' | 'medium' | 'high'
}

const riskColor: Record<ApprovalResult['riskLevel'], string> = {
  low: '#15803d',
  medium: '#b45309',
  high: '#b91c1c',
}

/** Renders an approval prompt for an approval-gated tool result. */
export function ApprovalCard({
  result,
  adminRoute = '/admin',
}: {
  result: ApprovalResult
  adminRoute?: string
}) {
  const [status, setStatus] = useState<'pending' | 'executing' | 'executed' | 'rejected' | 'error'>(
    'pending',
  )
  const [error, setError] = useState<string | null>(null)

  async function decide(decision: 'approve' | 'reject') {
    setStatus(decision === 'approve' ? 'executing' : 'pending')
    setError(null)
    try {
      const res = await fetch(`/api/claudia/actions/${result.actionId}/${decision}`, {
        method: 'post',
        headers: { 'Content-Type': 'application/json' },
      })
      const json = (await res.json()) as { error?: string; status?: string }
      if (!res.ok) {
        setStatus('error')
        setError(json.error ?? 'Request failed')
        return
      }
      setStatus(decision === 'approve' ? 'executed' : 'rejected')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Request failed')
    }
  }

  return (
    <div
      style={{
        border: `1px solid ${riskColor[result.riskLevel]}55`,
        borderLeft: `4px solid ${riskColor[result.riskLevel]}`,
        borderRadius: 8,
        padding: 12,
        margin: '6px 0',
        background: 'var(--theme-elevation-50, #fafafa)',
        fontSize: 13,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <AlertTriangle size={15} color={riskColor[result.riskLevel]} />
        <strong>Approval required</strong>
        <span
          style={{
            marginLeft: 'auto',
            color: riskColor[result.riskLevel],
            textTransform: 'uppercase',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {result.riskLevel} risk
        </span>
      </div>
      <p style={{ margin: '0 0 10px' }}>{result.summary}</p>

      {status === 'pending' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => decide('approve')} style={approveBtn}>
            <Check size={14} /> Approve
          </button>
          <button type="button" onClick={() => decide('reject')} style={rejectBtn}>
            <X size={14} /> Reject
          </button>
        </div>
      )}
      {status === 'executing' && <em>Executing…</em>}
      {status === 'executed' && <span style={{ color: riskColor.low }}>✓ Done</span>}
      {status === 'rejected' && <span style={{ opacity: 0.7 }}>Rejected</span>}
      {status === 'error' && <span style={{ color: riskColor.high }}>Error: {error}</span>}
    </div>
  )
}

const baseBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '5px 12px',
  borderRadius: 6,
  border: 'none',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
}
const approveBtn: React.CSSProperties = { ...baseBtn, background: '#15803d', color: '#fff' }
const rejectBtn: React.CSSProperties = {
  ...baseBtn,
  background: 'transparent',
  color: 'inherit',
  border: '1px solid var(--theme-elevation-200, #ccc)',
}

export default ApprovalCard
