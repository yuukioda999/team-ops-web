import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { api, errorMessage, fieldErrors, withCsrfRetry } from '../../api/client.ts'
import { Alert } from '../../components/Alert.tsx'
import { PageFrame } from '../../components/PageFrame.tsx'
import { Panel } from '../../components/Panel.tsx'
import { TextField } from '../../components/TextField.tsx'

const APP_NAME = 'チーム運営'

/**
 * ログイン用リンクを要求する(AC-001-01・02・05)。登録済みかどうかで表示は変えない。
 */
export function LoginPage() {
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)

  async function send(event?: FormEvent) {
    event?.preventDefault()
    setBusy(true)
    setError(null)
    setEmailError(undefined)
    const { response, error: body } = await withCsrfRetry(() => api.POST('/api/auth/login-links', { body: { email } }))
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
      <PageFrame title={APP_NAME}>
        <Panel tag="送信しました" meta="有効期限 15分" title="メールを確認してください">
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
    <PageFrame title={APP_NAME}>
      <Panel tag="ログイン" meta="パスワードは不要です" title="メールアドレスでログイン">
        <p className="panel__text">
          入力したメールアドレスに、ログイン用のリンクを送ります。はじめての方も、同じ手順で登録できます。
        </p>
      </Panel>
      {params.get('expired') === '1' && <Alert tone="info">ログインの有効期限が切れました。もう一度ログインしてください。</Alert>}
      {error !== null && <Alert tone="error">{error}</Alert>}
      <form className="sheet" onSubmit={(e) => void send(e)} noValidate>
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
