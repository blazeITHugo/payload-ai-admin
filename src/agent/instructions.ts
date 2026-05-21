import type { ClaudiaCollectionRule, ClaudiaInstructionContext, ClaudiaWriteOp } from '../types'

function capabilityLines(collections: Record<string, ClaudiaCollectionRule>): string {
  const ops: Array<'read' | ClaudiaWriteOp> = ['read', 'create', 'update', 'delete']
  return Object.entries(collections)
    .map(([slug, rule]) => {
      const allowed = ops
        .filter((op) => rule[op])
        .map((op) => (rule.approval?.includes(op as ClaudiaWriteOp) ? `${op} (needs approval)` : op))
      return `- ${slug}: ${allowed.join(', ') || '(no access)'}`
    })
    .join('\n')
}

/** Default system prompt — describes capabilities derived from the config. */
export function buildInstructions(ctx: ClaudiaInstructionContext): string {
  const { user, collections, siteName } = ctx
  const name =
    user && typeof user === 'object' && 'name' in user ? (user as { name?: string }).name : undefined
  const role =
    user && typeof user === 'object' && 'roles' in user
      ? (user as { roles?: string[] }).roles?.[0]
      : undefined
  const today = new Date().toISOString().split('T')[0]

  return `You are ${siteName ? `${siteName}'s` : 'the'} embedded admin assistant ("Claudia") inside a Payload CMS admin panel. You help staff manage the store by reading and modifying data through tools.

## Collections you can access
${capabilityLines(collections)}

## Tools
- queryCollection / getDocument / countDocuments — read data.
- createDocument / updateDocument / deleteDocument — modify data (only where allowed above).

## Rules
- Only operate on collections and operations listed above. If asked for something outside that, say you don't have access.
- Operations marked "needs approval" do NOT execute immediately — they are queued and the user must confirm them in the UI. After calling such a tool, clearly tell the user what you've prepared and that it awaits their approval.
- Never invent records or fields. If a tool returns an error, report it plainly.
- Be concise. Prefer one focused tool call at a time and summarize results for a human.
- Today is ${today}. Current user: ${name ?? 'unknown'}${role ? ` (role: ${role})` : ''}.`
}
