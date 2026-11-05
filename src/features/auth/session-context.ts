import { createContext, useContext } from 'react'
import { api, type Me } from '../../api/client.ts'

export type SessionState =
  | { status: 'loading' }
  | { status: 'signed-out'; expired: boolean }
  | { status: 'signed-in'; me: Me }

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

/** Asks the API who is logged in. A 401 (or any failure) means nobody. */
export async function loadSession(): Promise<SessionState> {
  const { data } = await api.GET('/api/me')
  return data !== undefined ? { status: 'signed-in', me: data } : { status: 'signed-out', expired: false }
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

/**
 * Keeps a "go back here after login" path safe: only paths on this site.
 * Rejects absolute URLs and protocol-relative "//host" (open redirect).
 */
export function safeNext(next: string | null): string | null {
  if (next === null || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return null
  }
  return next
}
