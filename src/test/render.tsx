import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import type { Me, Team } from '../api/client.ts'
import { routes } from '../routes.tsx'

export type Reply = { status: number; body?: unknown } | 'network-error'
/** "METHOD /path" -> reply, or a function for replies that depend on the request. */
export type Handlers = Record<string, Reply | ((body: unknown) => Reply | Promise<Reply>)>

export type Call = { method: string; path: string; body: unknown; headers: Headers }

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
      const text = request.method === 'GET' ? '' : await request.text()
      const body = text === '' ? undefined : JSON.parse(text)
      const key = `${request.method} ${url.pathname}`
      calls.push({ method: request.method, path: url.pathname, body, headers: request.headers })

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

export const team = (overrides: Partial<Team> = {}): Team => ({
  id: '01jc9zb4x7q2n6r8t0v2w4y6z8',
  name: 'あおば台FC U-10',
  sport: 'soccer',
  roles: ['representative'],
  permissions: { manage_invitation: true, review_join_requests: true },
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
