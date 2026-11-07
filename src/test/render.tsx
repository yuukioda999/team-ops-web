import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import type { Me, Team } from '../api/client.ts'
import { routes } from '../routes.tsx'

export type Reply = { status: number; body?: unknown } | 'network-error'
/** "METHOD /path" -> reply, or a function for replies that depend on the request. */
export type Handlers = Record<string, Reply | ((body: unknown) => Reply | Promise<Reply>)>

export type Call = { method: string; path: string; search: string; body: unknown; headers: Headers }

/**
 * Reads a multipart body into field name → text. request.formData() fails on Node 24 when the
 * FormData holds a jsdom File (undici rejects it), so the test fetch parses the text itself.
 */
export function parseMultipart(text: string, contentType: string): Record<string, string> {
  const boundary = /boundary=(.+)$/.exec(contentType)?.[1] ?? ''
  const fields: Record<string, string> = {}
  for (const part of text.split(`--${boundary}`)) {
    const [head, ...rest] = part.split('\r\n\r\n')
    const name = /name="([^"]+)"/.exec(head)?.[1]
    if (name !== undefined) fields[name] = rest.join('\r\n\r\n').replace(/\r\n$/, '')
  }
  return fields
}

/**
 * Renders the app at a path with a fake API. Unknown requests fail the test.
 * Returns the list of calls the screen made.
 */
export function renderAt(path: string, handlers: Handlers) {
  const calls: Call[] = []
  document.cookie = 'XSRF-TOKEN=test-xsrf-token; path=/'

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(new URL(String(input), 'http://localhost'), init)
      const url = new URL(request.url, 'http://localhost')
      let body: unknown
      const contentType = request.headers.get('Content-Type') ?? ''
      if (contentType.startsWith('multipart/form-data')) {
        body = parseMultipart(await request.text(), contentType)
      } else {
        const text = request.method === 'GET' ? '' : await request.text()
        body = text === '' ? undefined : JSON.parse(text)
      }
      const key = `${request.method} ${url.pathname}`
      calls.push({ method: request.method, path: url.pathname, search: url.search, body, headers: request.headers })

      const handler = handlers[key]
      if (handler === undefined) {
        throw new Error(`Unexpected request: ${key}`)
      }
      const reply = typeof handler === 'function' ? await handler(body) : handler
      if (reply === 'network-error') {
        throw new TypeError('Failed to fetch')
      }
      return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
        status: reply.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }),
  )

  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return { calls, router }
}

/** Permissions with everything off; pass the ones a role has */
export function permissions(on: Partial<Team['permissions']> = {}): Team['permissions'] {
  return {
    manage_invitation: false,
    review_join_requests: false,
    manage_players: false,
    view_players: false,
    view_all_players: false,
    update_team: false,
    view_members: false,
    manage_roles: false,
    remove_members: false,
    view_audit_logs: false,
    create_notices: false,
    manage_all_notices: false,
    ...on,
  }
}

/** A team where the member is the representative (every permission on) */
export const team = (overrides: Partial<Team> = {}): Team => ({
  id: '01jc9zb4x7q2n6r8t0v2w4y6z8',
  name: 'あおば台FC U-10',
  sport: 'soccer',
  roles: ['representative'],
  permissions: permissions({
    manage_invitation: true,
    review_join_requests: true,
    manage_players: true,
    view_players: true,
    view_all_players: true,
    update_team: true,
    view_members: true,
    manage_roles: true,
    remove_members: true,
    view_audit_logs: true,
    create_notices: true,
    manage_all_notices: true,
  }),
  ...overrides,
})

export const me = (overrides: Partial<Me> = {}): Me => ({
  email: 'coach@example.invalid',
  display_name: '小田 裕貴',
  needs_display_name: false,
  teams: [],
  join_requests: [],
  ...overrides,
})

export const signedOut: Reply = { status: 401, body: { message: 'ログインしてください' } }
export const signedIn = (overrides: Partial<Me> = {}) => ({ status: 200, body: me(overrides) })
