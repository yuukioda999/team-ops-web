import createClient, { type Middleware } from 'openapi-fetch'
import type { components, paths } from './schema'

/**
 * team-ops-api だけを呼ぶクライアント(CLAUDE.md)。型は openapi/openapi.yaml から生成したものを使う。
 *
 * 認証は Sanctum の SPA 認証(ADR-0008):Cookie のセッションで呼び、変更を伴うリクエストには
 * XSRF-TOKEN Cookie の値を X-XSRF-TOKEN ヘッダーに入れる。
 */

export type Me = components['schemas']['Me']
export type Team = components['schemas']['Team']
export type Sport = components['schemas']['Sport']
export type ValidationErrors = Record<string, string[]>

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/** ログインが切れたとき(401)に知らせるイベント。画面はログインに戻る(AC-001-07) */
export const SESSION_EXPIRED_EVENT = 'team-ops:session-expired'

export function readCookie(name: string): string | null {
  const prefix = `${name}=`
  for (const part of document.cookie.split('; ')) {
    if (part.startsWith(prefix)) {
      return decodeURIComponent(part.slice(prefix.length))
    }
  }
  return null
}

let csrfReady: Promise<void> | null = null

/** CSRF 対策の Cookie を受け取る。同時に何度呼ばれても、取りに行くのは1回だけ */
export function ensureCsrfCookie(force = false): Promise<void> {
  if (force || readCookie('XSRF-TOKEN') === null) {
    csrfReady ??= globalThis.fetch('/api/sanctum/csrf-cookie', { credentials: 'same-origin' }).then(() => {
      csrfReady = null
    })
    return csrfReady
  }
  return Promise.resolve()
}

const csrf: Middleware = {
  async onRequest({ request }) {
    if (SAFE_METHODS.has(request.method)) {
      return request
    }
    await ensureCsrfCookie()
    const token = readCookie('XSRF-TOKEN')
    if (token !== null) {
      request.headers.set('X-XSRF-TOKEN', token)
    }
    return request
  },
}

const sessionExpiry: Middleware = {
  onResponse({ response, request }) {
    const path = new URL(request.url, window.location.origin).pathname
    if (response.status === 401 && !path.startsWith('/api/auth/')) {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT))
    }
    return response
  },
}

export const api = createClient<paths>({
  // Same origin as the page; Vite (dev) and nginx (prod) forward /api to the API
  baseUrl: window.location.origin,
  credentials: 'same-origin',
  headers: { Accept: 'application/json' },
  // Look fetch up on each call (not once at startup), so tests can replace it
  fetch: (request) => globalThis.fetch(request),
})
api.use(csrf, sessionExpiry)

/**
 * 変更を伴う呼び出しを、CSRF のトークンが古い(419)ときだけ1回やり直す。
 * ページを長く開いたままにしていた場合などに起こる。
 */
export async function withCsrfRetry<T extends { response: Response }>(call: () => Promise<T>): Promise<T> {
  const first = await call()
  if (first.response.status !== 419) {
    return first
  }
  await ensureCsrfCookie(true)
  return call()
}

/** API のエラー応答 { message, errors? } から、画面に出す文言を取り出す */
export function errorMessage(error: unknown, fallback = '通信に失敗しました。時間をおいてもう一度お試しください'): string {
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return fallback
}

export function fieldErrors(error: unknown): ValidationErrors {
  if (typeof error === 'object' && error !== null && 'errors' in error && typeof error.errors === 'object' && error.errors !== null) {
    return error.errors as ValidationErrors
  }
  return {}
}
