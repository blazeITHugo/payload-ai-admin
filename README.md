# payload-ai-admin

A config-driven **AI control panel for [Payload CMS](https://payloadcms.com)**. Install the plugin,
declare which collections/fields/operations the AI may touch, and get a chat panel inside the Payload
admin that reads and edits your app on command.

Built on the [AI SDK v6](https://sdk.vercel.ai). Default model is Anthropic Claude; any AI SDK model works.

> **Status:** v0.x, experimental. The plugin API (a function `config => config`) is stable; option
> shapes may still change before 1.0.

## Why it's safe

Capability is enforced in **two layers**:

1. **Payload access control, as the user.** Every tool runs the Local API with the request's
   authenticated user and `overrideAccess: false`. The AI can never do anything the logged-in user
   couldn't do by hand — your existing collection/field access functions apply unchanged.
2. **A plugin allowlist (narrower).** `collections` declares per-slug `read/create/update/delete`,
   optional field include/exclude lists, and which writes require human approval. A tool for a
   slug/op you didn't allow is never even generated, so the model can't call it.

Auth is free: the chat is a Payload custom endpoint and the admin view reuses the Payload admin
session cookie — no separate app, JWT proxy, or second deployment.

## Install

```bash
pnpm add payload-ai-admin
```

Peer deps: `payload@^3.37`, `react@^19`, `react-dom@^19`, `next@^15 || ^16`.
Set `ANTHROPIC_API_KEY` in your environment (for the default model).

## Quick start

```ts
// payload.config.ts
import { buildConfig } from 'payload'
import { payloadAiAdmin } from 'payload-ai-admin'

export default buildConfig({
  // ...your config
  plugins: [
    payloadAiAdmin({
      // who may use the chat (defaults to any authenticated user)
      access: (user) => user?.roles?.includes('admin') ?? false,
      collections: {
        orders:   { read: true, update: true, approval: ['update'] },
        products: { read: true, create: true, update: true },
        users:    { read: true, fields: { exclude: ['salt', 'hash'] } },
      },
    }),
  ],
})
```

Run `payload generate:importmap` so the admin view + nav link resolve, start your app, and open
**`/admin/claudia`**.

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `collections` | `Record<string, ClaudiaCollectionRule>` | — | The capability map (required). |
| `access` | `(user) => boolean` | any authed user | Who may use the chat + see the audit ledger. |
| `model` | AI SDK `LanguageModel` | `anthropic('claude-sonnet-4-6')` | Any AI SDK v6 model. |
| `tools` | `(ctx) => Record<string, Tool>` | — | Register custom domain tools (access-scoped ctx). |
| `instructions` | `string \| (ctx) => string` | auto from config | Override/extend the system prompt. |
| `maxSteps` | `number` | `6` | Agent loop cap. |
| `label` | `string` | `'Claudia'` | Nav-item / view label. |
| `siteName` | `string` | — | Name injected into the system prompt. |
| `conversationsSlug` / `actionsSlug` | `string` | `claudia-conversations` / `claudia-actions` | Collection slugs added by the plugin. |
| `enabled` | `boolean` | `true` | Disable without uninstalling. |

`ClaudiaCollectionRule`:

```ts
{
  read?: boolean
  create?: boolean
  update?: boolean
  delete?: boolean
  fields?: { include?: string[]; exclude?: string[] }   // field-level scoping
  approval?: ('create' | 'update' | 'delete')[]          // writes that need human OK
}
```

## How it works

- Adds two collections: **`claudia-conversations`** (chat history) and **`claudia-actions`**
  (an audit ledger — `preview → executed/failed/reverted`).
- Adds endpoints **`POST /api/claudia/chat`** (streams the agent via AI SDK) and
  **`POST /api/claudia/actions/:id/:decision`** (approve/reject a queued write).
- Generic tools (`queryCollection`, `getDocument`, `countDocuments`, `createDocument`,
  `updateDocument`, `deleteDocument`) are generated from your `collections` config.
- Approval-gated writes don't mutate — they record a `preview` row and surface an approval card;
  the change executes only when a human approves it.
- Registers an embedded admin view at `/admin/claudia` + a nav link.

## Custom tools

```ts
import { tool } from 'ai'
import { z } from 'zod'

payloadAiAdmin({
  collections: { orders: { read: true } },
  tools: ({ payload, req }) => ({
    refundOrder: tool({
      description: 'Refund an order via the payment provider.',
      inputSchema: z.object({ orderId: z.number() }),
      execute: async ({ orderId }) => {
        // your domain logic; payload/req are access-scoped
        return { ok: true }
      },
    }),
  }),
})
```

## Development

```bash
pnpm install
pnpm build       # tsc → dist (preserves 'use client')
pnpm test        # vitest
```

Currently dogfooded inside a full Payload ecommerce app. A standalone `dev/` harness
(via `create-payload-app --template plugin`) is on the roadmap.

## License

MIT
