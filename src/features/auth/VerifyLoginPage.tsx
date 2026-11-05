import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { api, errorMessage, withCsrfRetry } from '../../api/client.ts'
import { PageFrame } from '../../components/PageFrame.tsx'
import { Panel } from '../../components/Panel.tsx'
import { safeNext, useSession } from './session-context.ts'

/**
 * メールのリンクから開く画面。開いただけではログインせず、ボタンを押したときに
 * トークンを使う(ADR-0008:迷惑メール対策の自動確認でリンクが使い切られないように)。
 */
export function VerifyLoginPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { setMe } = useSession()
  const token = params.get('token') ?? ''
  const [failure, setFailure] = useState<string | null>(token === '' ? 'リンクの有効期限が切れています' : null)
  const [busy, setBusy] = useState(false)

  async function logIn() {
    setBusy(true)
    const { data, response, error } = await withCsrfRetry(() =>
      api.POST('/api/auth/login-links/consume', { body: { token } }),
    )
    setBusy(false)
    if (data !== undefined) {
      setMe(data)
      const next = safeNext(params.get('next'))
      navigate(data.needs_display_name ? '/welcome' : (next ?? '/'), { replace: true })
      return
    }
    setFailure(response.status === 410 ? 'リンクの有効期限が切れています' : errorMessage(error))
  }

  if (failure !== null) {
    return (
      <PageFrame title="チーム運営">
        <Panel tag="ログイン" title={failure}>
          <p className="panel__text">リンクは送信から15分で無効になり、1回だけ使えます。もう一度ログイン用のリンクを送ってください。</p>
          <Link to="/login" className="button button--accent">
            ログイン用のリンクを送り直す
          </Link>
        </Panel>
      </PageFrame>
    )
  }

  return (
    <PageFrame title="チーム運営">
      <Panel tag="ログイン" meta="あと1ステップ" title="ログインしますか">
        <p className="panel__text">下のボタンを押すとログインします。このリンクは1回だけ使えます。</p>
        <button type="button" className="button button--accent" onClick={() => void logIn()} disabled={busy}>
          {busy ? 'ログインしています' : 'ログインする'}
        </button>
      </Panel>
    </PageFrame>
  )
}
