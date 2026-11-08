import { useContext, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { api, errorMessage, withCsrfRetry, type TeamRole } from '../api/client.ts'
import { SessionContext } from '../features/auth/session-context.ts'
import { DEMO_ROLES } from '../features/demo/demo-mode.ts'

/**
 * デモユーザーに常に出す表示(AC-007-04)と、役割の切り替え(AC-007-05)、送信されたメールへの導線(AC-007-12)。
 */
export function DemoBanner() {
  const session = useContext(SessionContext)
  const navigate = useNavigate()
  const me = session?.state.status === 'signed-in' ? session.state.me : null
  const teamId = me?.demo_team_id ?? null
  const current = me?.teams.find((t) => t.id === teamId)?.roles[0]
  const [role, setRole] = useState<TeamRole | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (me === null || teamId === null || session === null) return null
  const chosen = role ?? current ?? 'representative'

  async function switchRole() {
    setBusy(true)
    setError(null)
    try {
      const { data, error: body } = await withCsrfRetry(() => api.POST('/api/demo/sessions/switch', { body: { role: chosen } }))
      if (data !== undefined) {
        session?.setMe(data)
        setRole(null)
        navigate(`/teams/${teamId}`)
      } else {
        setError(errorMessage(body))
      }
    } catch {
      setError(errorMessage(null))
    }
    setBusy(false)
  }

  return (
    <aside className="demo-banner" aria-label="デモ環境">
      <p className="demo-banner__text">デモ環境です。入力したデータは24時間後に削除されます</p>
      <div className="demo-banner__row">
        <label className="demo-banner__label" htmlFor="demo-role">
          役割
        </label>
        <select id="demo-role" className="demo-banner__select" value={chosen} onChange={(e) => setRole(e.target.value as TeamRole)}>
          {DEMO_ROLES.map((r) => (
            <option key={r.role} value={r.role}>
              {r.label}
            </option>
          ))}
        </select>
        <button type="button" className="demo-banner__button" disabled={busy || chosen === current} onClick={() => void switchRole()}>
          {busy ? '切り替えています' : '切り替える'}
        </button>
        <Link to={`/teams/${teamId}/demo/mails`} className="demo-banner__link">
          送信されたメール
        </Link>
      </div>
      {error !== null && (
        <p className="demo-banner__error" role="alert">
          {error}
        </p>
      )}
    </aside>
  )
}
