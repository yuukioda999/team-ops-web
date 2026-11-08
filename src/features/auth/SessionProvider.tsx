import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { SESSION_EXPIRED_EVENT } from '../../api/client.ts'
import { loadSession, SessionContext, type Session, type SessionState } from './session-context.ts'

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' })

  useEffect(() => {
    let active = true
    void loadSession().then((loaded) => {
      if (active) setState(loaded)
    })
    return () => {
      active = false
    }
  }, [])

  // A 401 from any API call means the session has ended (AC-001-07)
  useEffect(() => {
    const onExpired = (event: Event) => {
      const demo = (event as CustomEvent<{ demo?: boolean } | null>).detail?.demo === true
      setState((s) => (s.status === 'signed-in' ? { status: 'signed-out', expired: demo ? 'demo' : true } : s))
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
  }, [])

  const refresh = useCallback(async () => setState(await loadSession()), [])

  const value = useMemo<Session>(
    () => ({
      state,
      setMe: (me) => setState({ status: 'signed-in', me }),
      clear: () => setState({ status: 'signed-out', expired: false }),
      refresh,
    }),
    [state, refresh],
  )

  return <SessionContext value={value}>{children}</SessionContext>
}
