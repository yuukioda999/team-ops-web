import { createContext, useContext } from 'react'
import { api, type Me } from '../../api/client.ts'

export type SessionState =
  | { status: 'loading' }
  /** expired:'demo' はデモチームが期限切れで消えた(AC-007-08) */
  | { status: 'signed-out'; expired: boolean | 'demo' }
  | { status: 'signed-in'; me: Me }
  /** The API could not be reached or failed. Not the same as being logged out. */
  | { status: 'unavailable' }

export type Session = {
  state: SessionState
  /** Replace the current user (after login, or after an update that returns Me). */
  setMe: (me: Me) => void
  /** Forget the user locally (after logout). */
  clear: () => void
  /** Load the user again from the API. */
  refresh: () => Promise<void>
}

export const SessionContext = createContext<Session | null>(null)

let pending: Promise<SessionState> | null = null

/**
 * Asks the API who is logged in. Only a 401 means nobody; other failures are shown as errors.
 * Calls made while a request is in flight share it, so there is never more than one.
 */
export function loadSession(): Promise<SessionState> {
  pending ??= fetchSession().finally(() => {
    pending = null
  })
  return pending
}

async function fetchSession(): Promise<SessionState> {
  const { data, error, response } = await api.GET('/api/me')
  if (data !== undefined) return { status: 'signed-in', me: data }
  if (response.status !== 401) return { status: 'unavailable' }
  return { status: 'signed-out', expired: (error as { reason?: string } | undefined)?.reason === 'demo_expired' ? 'demo' : false }
}

/**
 * Waits until no session request is in flight. Call it before logging in: a GET /api/me
 * sent while logged out gets a new guest session cookie in its response, and if that
 * response arrives after the login response it replaces the new session cookie, which
 * logs the user straight out again.
 */
export async function sessionSettled(): Promise<void> {
  while (pending !== null) {
    await pending.catch(() => undefined)
  }
}

export function useSession(): Session {
  const session = useContext(SessionContext)
  if (session === null) {
    throw new Error('useSession must be used inside SessionProvider')
  }
  return session
}

/** The logged-in user. Only for pages behind RequireSignedIn. */
export function useMe(): Me {
  const { state } = useSession()
  if (state.status !== 'signed-in') {
    throw new Error('useMe is only available on signed-in pages')
  }
  return state.me
}
