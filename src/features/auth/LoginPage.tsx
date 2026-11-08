import { useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { DemoLogin } from '../demo/DemoLogin.tsx'
import { useDemoMode } from '../demo/demo-mode.ts'
import { Loading } from './guards.tsx'
import { api, errorMessage, fieldErrors, withCsrfRetry } from '../../api/client.ts'
import { Alert } from '../../components/Alert.tsx'
import { PageFrame } from '../../components/PageFrame.tsx'
import { Panel } from '../../components/Panel.tsx'
import { TextField } from '../../components/TextField.tsx'
import { useFocusFirstInvalid } from '../../components/use-focus-first-invalid.ts'
import { peekReturnTo } from './return-to.ts'

const APP_NAME = 'チーム運営'

/**
 * ログイン用リンクを要求する(AC-001-01・02・05)。登録済みかどうかで表示は変えない。
 * デモモードでは、メールアドレスの入力欄を出さず、デモとしてログインだけを出す(AC-007-01・03)。
 */
export function LoginPage() {
  const [params] = useSearchParams()
  const demo = useDemoMode()
  if (demo === null) return <Loading />
  if (demo) {
    return (
      <PageFrame title={APP_NAME} pageTitle="デモとしてログイン">
        {/* デモモードのセッションはすべてデモなので、ふつうのログイン切れ(expired=1)も期限切れとして伝える(AC-007-08) */}
        <DemoLogin expired={params.get('expired') === 'demo' || params.get('expired') === '1'} />
      </PageFrame>
    )
  }
  return <EmailLogin expired={params.get('expired') === '1'} />
}

function EmailLogin({ expired }: { expired: boolean }) {
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const form = useRef<HTMLFormElement>(null)
  useFocusFirstInvalid(form, emailError)

  async function send(event?: FormEvent) {
    event?.preventDefault()
    setBusy(true)
    setError(null)
    setEmailError(undefined)
    // The page to come back to after logging in travels with the login link (AC-001-19), so it
    // works even when the mail is opened in another tab or app. The API accepts only known paths.
    const returnTo = peekReturnTo()
    const { response, error: body } = await withCsrfRetry(() =>
      api.POST('/api/auth/login-links', { body: returnTo === null ? { email } : { email, return_to: returnTo } }),
    )
    setBusy(false)

    if (response.status === 202) {
      setSentTo(email.trim())
    } else if (response.status === 422) {
      setEmailError(fieldErrors(body).email?.[0] ?? errorMessage(body))
    } else {
      // 429: too many requests (AC-001-05), or a network/server error
      setError(errorMessage(body))
    }
  }

  if (sentTo !== null) {
    return (
      <PageFrame title={APP_NAME} pageTitle="メールを送信しました">
        <Panel tag="ログイン" meta="有効期限 15分" title="メールを送信しました">
          <p className="panel__text">
            <strong>{sentTo}</strong> にログイン用のリンクを送りました。メールのリンクを開き、表示された画面で「ログインする」を押してください。
          </p>
        </Panel>
        {error !== null && <Alert tone="error">{error}</Alert>}
        <section className="sheet" aria-labelledby="not-arrived">
          <h2 id="not-arrived" className="sheet__title">
            メールが届かないとき
          </h2>
          <p className="sheet__text">迷惑メールのフォルダも確認してください。数分待っても届かないときは、もう一度送ってください。</p>
          <button type="button" className="button button--primary" onClick={() => void send()} disabled={busy}>
            {busy ? '送信しています' : 'もう一度送る'}
          </button>
          <button type="button" className="button button--secondary" onClick={() => setSentTo(null)}>
            別のメールアドレスで送る
          </button>
        </section>
      </PageFrame>
    )
  }

  return (
    <PageFrame title={APP_NAME} pageTitle="ログイン">
      <Panel tag="ログイン" meta="パスワードは不要です" title="メールアドレスでログイン">
        <p className="panel__text">
          入力したメールアドレスに、ログイン用のリンクを送ります。はじめての方も、同じ手順で登録できます。
        </p>
      </Panel>
      {expired && <Alert tone="info">ログインの有効期限が切れました。もう一度ログインしてください。</Alert>}
      {error !== null && <Alert tone="error">{error}</Alert>}
      <form ref={form} className="sheet" onSubmit={(e) => void send(e)} noValidate>
        <TextField
          label="メールアドレス"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={emailError}
        />
        <button type="submit" className="button button--accent" disabled={busy}>
          {busy ? '送信しています' : 'ログイン用のリンクを送る'}
        </button>
      </form>
    </PageFrame>
  )
}
