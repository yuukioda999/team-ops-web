import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, readCookie, SESSION_EXPIRED_EVENT, withCsrfRetry } from './client.ts'

function clearCookies() {
  for (const c of document.cookie.split('; ')) {
    const name = c.split('=')[0]
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
  }
}

describe('API client', () => {
  afterEach(() => clearCookies())

  it('fetches the CSRF cookie before the first change and sends it as X-XSRF-TOKEN', async () => {
    clearCookies()
    const seen: { url: string; token: string | null }[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input)
      seen.push({ url, token: input instanceof Request ? input.headers.get('X-XSRF-TOKEN') : null })
      if (url.endsWith('/api/sanctum/csrf-cookie')) {
        document.cookie = 'XSRF-TOKEN=abc%3D%3D; path=/'
        return new Response(null, { status: 204 })
      }
      return new Response(JSON.stringify({ message: 'メールを送信しました' }), { status: 202 })
    }))

    await api.POST('/api/auth/login-links', { body: { email: 'a@example.invalid' } })

    expect(seen.map((s) => new URL(s.url, 'http://localhost').pathname)).toEqual(['/api/sanctum/csrf-cookie', '/api/auth/login-links'])
    expect(seen[1]?.token).toBe('abc==')
    expect(readCookie('XSRF-TOKEN')).toBe('abc==')
  })

  it('retries once with a fresh CSRF cookie when the token has expired (419)', async () => {
    document.cookie = 'XSRF-TOKEN=old; path=/'
    let posts = 0
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url.endsWith('/api/sanctum/csrf-cookie')) {
        document.cookie = 'XSRF-TOKEN=new; path=/'
        return new Response(null, { status: 204 })
      }
      posts++
      return posts === 1
        ? new Response(JSON.stringify({ message: 'ページの有効期限が切れました' }), { status: 419 })
        : new Response(JSON.stringify({ message: 'メールを送信しました' }), { status: 202 })
    }))

    const { response } = await withCsrfRetry(() => api.POST('/api/auth/login-links', { body: { email: 'a@example.invalid' } }))

    expect(response.status).toBe(202)
    expect(posts).toBe(2)
  })

  it('AC-001-07 announces an ended session on a 401, except from the login endpoints', async () => {
    document.cookie = 'XSRF-TOKEN=t; path=/'
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'ログインしてください' }), { status: 401 })))
    const listener = vi.fn()
    window.addEventListener(SESSION_EXPIRED_EVENT, listener)

    await api.GET('/api/teams/{team}', { params: { path: { team: 'x' } } })
    await api.POST('/api/auth/login-links/consume', { body: { token: 'x' } })

    expect(listener).toHaveBeenCalledTimes(1)
    window.removeEventListener(SESSION_EXPIRED_EVENT, listener)
  })
})
