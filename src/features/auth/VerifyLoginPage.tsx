import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { api, errorMessage, withCsrfRetry } from '../../api/client.ts'
import { PageFrame } from '../../components/PageFrame.tsx'
import { Panel } from '../../components/Panel.tsx'
import { safeNext, saveReturnTo, takeReturnTo } from './return-to.ts'
import { sessionSettled, useSession } from './session-context.ts'
import { useLinkToken } from './use-link-token.ts'

/**
 * メールのリンクから開く画面。開いただけではログインせず、ボタンを押したときに
 * トークンを使う(ADR-0008:迷惑メール対策の自動確認でリンクが使い切られないように)。
 */
export function VerifyLoginPage() {
  const navigate = useNavigate()
  const { setMe } = useSession()
  const token = useLinkToken()
  const [failure, setFailure] = useState<string | null>(token === '' ? 'リンクの有効期限が切れています' : null)
  const [busy, setBusy] = useState(false)

  async function logIn() {
    setBusy(true)
    await sessionSettled()
    const { data, response, error } = await withCsrfRetry(() =>
      api.POST('/api/auth/login-links/consume', { body: { token } }),
    )
    setBusy(false)
    if (data !== undefined) {
      setMe(data)
      // The page the user came from: kept by the API with the login link (AC-001-19), or saved in this tab
      const local = takeReturnTo()
      const next = safeNext(data.return_to ?? null) ?? local
      if (next?.startsWith('/join') === true) {
        // The join request form asks for the display name itself (002 decision 5)
        navigate(next, { replace: true })
      } else if (data.needs_display_name) {
        // A new user enters a display name first; WelcomePage then goes to the saved page
        if (next !== null) saveReturnTo(next)
        navigate('/welcome', { replace: true })
      } else {
        navigate(next ?? '/', { replace: true })
      }
      return
    }
    // 410 expired/used, 422 malformed link: the same message (AC-001-04)
    setFailure(response.status === 410 || response.status === 422 ? 'リンクの有効期限が切れています' : errorMessage(error))
  }

  if (failure !== null) {
    return (
      <PageFrame title="チーム運営" pageTitle={failure}>
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
    <PageFrame title="チーム運営" pageTitle="ログインの確認">
      <Panel tag="ログイン" meta="あと1ステップ" title="ログインしますか">
        <p className="panel__text">下のボタンを押すとログインします。このリンクは1回だけ使えます。</p>
        <button type="button" className="button button--accent" onClick={() => void logIn()} disabled={busy}>
          {busy ? 'ログインしています' : 'ログインする'}
        </button>
      </Panel>
    </PageFrame>
  )
}
