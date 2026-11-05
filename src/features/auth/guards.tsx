import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useSession } from './session-context.ts'

export function Loading() {
  return (
    <p className="loading" role="status" aria-live="polite">
      読み込んでいます
    </p>
  )
}

/** Pages that need login. Others are sent to the login page and come back afterwards. */
export function RequireSignedIn({ children, allowIncomplete = false }: { children: ReactNode; allowIncomplete?: boolean }) {
  const { state } = useSession()
  const location = useLocation()
  const here = location.pathname + location.search

  if (state.status === 'loading') {
    return <Loading />
  }
  if (state.status === 'signed-out') {
    const params = new URLSearchParams({ next: here })
    if (state.expired) {
      params.set('expired', '1')
    }
    return <Navigate to={`/login?${params.toString()}`} replace />
  }
  // Until the display name is entered, registration is not complete (AC-001-08)
  if (!allowIncomplete && state.me.needs_display_name) {
    return <Navigate to={`/welcome?${new URLSearchParams({ next: here }).toString()}`} replace />
  }
  return children
}

/** "/" goes to the first team, or to the start page for people in no team (AC-001-14). */
export function HomeRedirect() {
  const { state } = useSession()
  if (state.status === 'loading') {
    return <Loading />
  }
  if (state.status === 'signed-out') {
    return <Navigate to="/login" replace />
  }
  if (state.me.needs_display_name) {
    return <Navigate to="/welcome" replace />
  }
  const first = state.me.teams[0]
  return <Navigate to={first !== undefined ? `/teams/${first.id}` : '/start'} replace />
}
