import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { PageFrame } from '../../components/PageFrame.tsx'
import { Panel } from '../../components/Panel.tsx'
import { saveReturnTo } from './return-to.ts'
import { useSession } from './session-context.ts'

export function Loading() {
  return (
    <p className="loading" role="status" aria-live="polite">
      読み込んでいます
    </p>
  )
}

/** The API could not be reached: say so instead of sending the user to the login page. */
export function Unavailable() {
  const { refresh } = useSession()
  return (
    <PageFrame title="チーム運営" pageTitle="接続できません">
      <Panel tag="接続できません" title="サーバーに接続できませんでした">
        <p className="panel__text">通信が不安定か、サーバーが一時的に止まっています。時間をおいて、もう一度読み込んでください。</p>
        <button type="button" className="button button--accent" onClick={() => void refresh()}>
          もう一度読み込む
        </button>
      </Panel>
    </PageFrame>
  )
}

/** Pages that need login. Others are sent to the login page and come back afterwards. */
export function RequireSignedIn({ children, allowIncomplete = false }: { children: ReactNode; allowIncomplete?: boolean }) {
  const { state } = useSession()
  const location = useLocation()

  if (state.status === 'loading') {
    return <Loading />
  }
  if (state.status === 'unavailable') {
    return <Unavailable />
  }
  if (state.status === 'signed-out') {
    saveReturnTo(location.pathname + location.search)
    return <Navigate to={state.expired === 'demo' ? '/login?expired=demo' : state.expired ? '/login?expired=1' : '/login'} replace />
  }
  // Until the display name is entered, registration is not complete (AC-001-08)
  if (!allowIncomplete && state.me.needs_display_name) {
    saveReturnTo(location.pathname + location.search)
    return <Navigate to="/welcome" replace />
  }
  return children
}

/** "/" goes to the first team, or to the start page for people in no team (AC-001-14). */
export function HomeRedirect() {
  const { state } = useSession()
  if (state.status === 'loading') {
    return <Loading />
  }
  if (state.status === 'unavailable') {
    return <Unavailable />
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
