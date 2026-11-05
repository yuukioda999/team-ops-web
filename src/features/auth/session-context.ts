import { createContext, useContext } from 'react'
import { api, type Me } from '../../api/client.ts'

export type SessionState =
  | { status: 'loading' }
  | { status: 'signed-out'; expired: boolean }
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

/** Asks the API who is logged in. Only a 401 means nobody; other failures are shown as errors. */
export async function loadSession(): Promise<SessionState> {
  const { data, response } = await api.GET('/api/me')
  if (data !== undefined) return { status: 'signed-in', me: data }
  return response.status === 401 ? { status: 'signed-out', expired: false } : { status: 'unavailable' }
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
