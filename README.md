# payload-ai-admin

[![npm version](https://img.shields.io/npm/v/payload-ai-admin.svg)](https://www.npmjs.com/package/payload-ai-admin)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A config-driven **AI control panel for [PayloadCMS](https://payloadcms.com/)**. Install the plugin, declare which collections/fields/operations the AI may touch, and get a chat panel inside the Payload admin that reads and edits your app on command.

Built on the [AI SDK v6](https://sdk.vercel.ai/). The default model is Anthropic Claude; any AI SDK model works.

> **Status:** v0.x, experimental. The plugin API (a function `config => config`) is stable; option shapes may still change before 1.0.

## Why it's safe

Capability is enforced in **two layers**:

1. **Payload access control, as the user.** Every tool runs the Local API with the request's authenticated user and `overrideAccess: false`. The AI can never do anything the logged-in user couldn't do by hand — your existing collection/field access functions apply unchanged.
2. **A plugin allowlist (narrower).** `collections` declares per-slug `read/create/update/delete`, optional field include/exclude lists, and which writes require human approval. A tool for a slug/op you didn't allow is never even generated, so the model can't call it.

Auth is free: the chat is a Payload custom endpoint and the admin view reuses the Payload admin session cookie — no separate app, JWT proxy, or second deployment.

## Features

- Config-driven capability map — declare per-collection `read/create/update/delete`
- Two-layer security: Payload access control (`overrideAccess: false`) + a narrower plugin allowlist
- Field-level scoping with include/exclude lists (e.g. hide `salt`/`hash`)
- Human-in-the-loop approval gating for destructive or sensitive writes
- Audit ledger of every action (`preview → executed/failed/reverted`)
- Embedded admin chat view + nav link — reuses the Payload admin session, no second app
- Custom domain tools, access-scoped to the logged-in user
- Built on AI SDK v6 — Anthropic Claude by default, any AI SDK model supported
- Full TypeScript support
- Next.js 15 / 16 + React 19 compatible

## Installation

```bash
npm install payload-ai-admin
# or
pnpm add payload-ai-admin
# or
yarn add payload-ai-admin
```

## Requirements

- PayloadCMS 3.x (`payload@^3.37`)
- Next.js 15+ or Next.js 16
- React 19 (`react@^19`, `react-dom@^19`)
- `ANTHROPIC_API_KEY` in your environment (for the default model)

## Quick Start

### 1. Server Configuration

Add the plugin to your Payload config and declare what the AI may touch:

```typescript
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

### 2. Generate the import map

```bash
payload generate:importmap
```

This resolves the embedded admin view + nav link.

### 3. Environment Variables

```env
ANTHROPIC_API_KEY=sk-ant-...
```

Start your app and open **`/admin/claudia`**.

## Configuration Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `collections` | `Record<string, ClaudiaCollectionRule>` | **required** | The capability map. |
| `access` | `(user) => boolean` | any authed user | Who may use the chat + see the audit ledger. |
| `model` | AI SDK `LanguageModel` | `anthropic('claude-sonnet-4-6')` | Any AI SDK v6 model. |
| `tools` | `(ctx) => Record<string, Tool>` | — | Register custom domain tools (access-scoped ctx). |
| `instructions` | `string \| (ctx) => string` | auto from config | Override/extend the system prompt. |
| `maxSteps` | `number` | `6` | Agent loop cap. |
| `label` | `string` | `'Claudia'` | Nav-item / view label. |
| `siteName` | `string` | — | Name injected into the system prompt. |
| `conversationsSlug` | `string` | `claudia-conversations` | Slug for the chat-history collection. |
| `actionsSlug` | `string` | `claudia-actions` | Slug for the audit-ledger collection. |
| `enabled` | `boolean` | `true` | Disable without uninstalling. |

### Collection rule (`ClaudiaCollectionRule`)

```typescript
{
  read?: boolean
  create?: boolean
  update?: boolean
  delete?: boolean
  fields?: { include?: string[]; exclude?: string[] }   // field-level scoping
  approval?: ('create' | 'update' | 'delete')[]          // writes that need human OK
}
```

## How It Works

- Adds two collections: **`claudia-conversations`** (chat history) and **`claudia-actions`** (an audit ledger — `preview → executed/failed/reverted`).
- Adds endpoints **`POST /api/claudia/chat`** (streams the agent via AI SDK) and **`POST /api/claudia/actions/:id/:decision`** (approve/reject a queued write).
- Generic tools (`queryCollection`, `getDocument`, `countDocuments`, `createDocument`, `updateDocument`, `deleteDocument`) are generated from your `collections` config.
- Approval-gated writes don't mutate — they record a `preview` row and surface an approval card; the change executes only when a human approves it.
- Registers an embedded admin view at `/admin/claudia` + a nav link.

## Custom Tools

Register domain-specific tools alongside the generated CRUD tools. The context (`payload`/`req`) is access-scoped to the logged-in user:

```typescript
import { tool } from 'ai'
import { z } from 'zod'
import { payloadAiAdmin } from 'payload-ai-admin'

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

## TypeScript

Full TypeScript support. The package ships type declarations and three entry points:

```typescript
import { payloadAiAdmin } from 'payload-ai-admin'        // server / payload.config.ts
import { /* client components */ } from 'payload-ai-admin/client'
import { /* RSC exports */ } from 'payload-ai-admin/rsc'
```

## Development

```bash
pnpm install
pnpm build       # tsc → dist (preserves 'use client')
pnpm test        # vitest
```

Currently dogfooded inside a full Payload ecommerce app. A standalone `dev/` harness (via `create-payload-app --template plugin`) is on the roadmap.

## Changelog

### 0.1.0

- Initial release

## Contributing

Contributions are welcome! Please open an issue or pull request.

## License

MIT © [blaze IT s.r.o.](https://www.blazeit.sk/)

## Links

- [PayloadCMS](https://payloadcms.com/)
- [AI SDK](https://sdk.vercel.ai/)
- [Anthropic Claude](https://www.anthropic.com/claude)
