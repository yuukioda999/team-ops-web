import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { api, errorMessage, withCsrfRetry, type TeamRole } from '../../api/client.ts'
import { Alert } from '../../components/Alert.tsx'
import { Panel } from '../../components/Panel.tsx'
import { sessionSettled, useSession } from '../auth/session-context.ts'
import { DEMO_ROLES } from './demo-mode.ts'

/**
 * デモとしてログイン(AC-007-01・02)。役割を選ぶと、自分専用のデモチームが作られる。
 * デモ環境ではメールアドレスでのログインは使えない(AC-007-03)。
 */
export function DemoLogin({ expired }: { expired: boolean }) {
  const { setMe } = useSession()
  const navigate = useNavigate()
  const [role, setRole] = useState<TeamRole>('representative')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await sessionSettled()
      const { data, error: body } = await withCsrfRetry(() => api.POST('/api/demo/sessions', { body: { role } }))
      if (data !== undefined && data.demo_team_id !== null) {
        setMe(data)
        navigate(`/teams/${data.demo_team_id}`, { replace: true })
        return
      }
      // 429:同じ回線から作りすぎ(AC-007-09)、503:混雑(AC-007-10)
      setError(errorMessage(body))
    } catch {
      setError(errorMessage(null))
    }
    setBusy(false)
  }

  return (
    <>
      <Panel tag="デモ" meta="登録は不要です" title="デモとしてログイン">
        <p className="panel__text">
          あなた専用のデモチームを作ります。名前はすべて架空で、メールは外部に送られません。入力したデータは24時間後に削除されます。
        </p>
      </Panel>
      {expired && <Alert tone="info">デモの有効期限が切れました。もう一度デモとしてログインしてください。</Alert>}
      {error !== null && <Alert tone="error">{error}</Alert>}
      <form className="sheet" onSubmit={(e) => void start(e)}>
        <fieldset className="choices">
          <legend className="choices__legend">ログインする役割</legend>
          {DEMO_ROLES.map((r) => (
            <label key={r.role} className="choice choice--described">
              <input type="radio" name="role" value={r.role} checked={role === r.role} onChange={() => setRole(r.role)} />
              <span>
                {r.label}
                <span className="choice__note">{r.note}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <p className="field__hint">あとから画面上部で役割を切り替えられます。</p>
        <button type="submit" className="button button--accent" disabled={busy}>
          {busy ? 'デモチームを作っています' : 'デモとしてログイン'}
        </button>
      </form>
    </>
  )
}
