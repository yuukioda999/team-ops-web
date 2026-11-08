import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { api, errorMessage, fieldErrors, withCsrfRetry } from '../../api/client.ts'
import { Alert } from '../../components/Alert.tsx'
import { PageFrame } from '../../components/PageFrame.tsx'
import { TextField } from '../../components/TextField.tsx'
import { useFocusFirstInvalid } from '../../components/use-focus-first-invalid.ts'
import { useDemoMode } from '../demo/demo-mode.ts'
import { useMe, useSession } from './session-context.ts'

/** アカウント設定:表示名の変更、メールアドレスの変更、ログアウト(AC-001-06・08・09)。 */
export function SettingsPage() {
  const me = useMe()
  // デモモードかどうかで止める(ADR-0021)。デモユーザーならデモモードなので、分かるまでも出さない
  const demo = useDemoMode() === true || me.demo_team_id !== null
  const { setMe, clear } = useSession()
  const navigate = useNavigate()

  const [name, setName] = useState(me.display_name ?? '')
  const [nameError, setNameError] = useState<string | undefined>()
  const [nameSaved, setNameSaved] = useState(false)

  const [newEmail, setNewEmail] = useState('')
  const [emailError, setEmailError] = useState<string | undefined>()
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'name' | 'email' | 'logout' | null>(null)
  const nameForm = useRef<HTMLFormElement>(null)
  const emailForm = useRef<HTMLFormElement>(null)
  useFocusFirstInvalid(nameForm, nameError)
  useFocusFirstInvalid(emailForm, emailError)

  async function saveName(event: FormEvent) {
    event.preventDefault()
    setBusy('name')
    setNameError(undefined)
    setNameSaved(false)
    setError(null)
    const { data, response, error: body } = await withCsrfRetry(() => api.PATCH('/api/me', { body: { display_name: name } }))
    setBusy(null)
    if (data !== undefined) {
      setMe(data)
      setNameSaved(true)
    } else if (response.status === 422) {
      setNameError(fieldErrors(body).display_name?.[0] ?? errorMessage(body))
    } else {
      setError(errorMessage(body))
    }
  }

  async function requestEmailChange(event: FormEvent) {
    event.preventDefault()
    setBusy('email')
    setEmailError(undefined)
    setError(null)
    const { response, error: body } = await withCsrfRetry(() =>
      api.POST('/api/me/email-changes', { body: { new_email: newEmail } }),
    )
    setBusy(null)
    if (response.status === 202) {
      setEmailSentTo(newEmail.trim())
      setNewEmail('')
    } else if (response.status === 422) {
      setEmailError(fieldErrors(body).new_email?.[0] ?? errorMessage(body))
    } else {
      setError(errorMessage(body))
    }
  }

  async function logOut() {
    setBusy('logout')
    const { response, error: body } = await withCsrfRetry(() => api.POST('/api/auth/logout'))
    setBusy(null)
    if (response.status === 204 || response.status === 401) {
      clear()
      navigate('/login', { replace: true })
    } else {
      setError(errorMessage(body))
    }
  }

  return (
    <PageFrame title="アカウント設定" pageTitle="アカウント設定" signedInAs={me.email}>
      <h1 className="visually-hidden">アカウント設定</h1>
      {error !== null && <Alert tone="error">{error}</Alert>}

      <form ref={nameForm} className="sheet" onSubmit={(e) => void saveName(e)} noValidate aria-labelledby="name-title">
        <h2 id="name-title" className="sheet__title">
          表示名の変更
        </h2>
        <TextField
          label="表示名"
          name="display_name"
          autoComplete="name"
          maxLength={30}
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setNameSaved(false)
          }}
          hint="チームのメンバーに表示されます。30文字まで"
          error={nameError}
        />
        {nameSaved && <Alert tone="info">表示名を保存しました</Alert>}
        <button type="submit" className="button button--primary" disabled={busy === 'name'}>
          {busy === 'name' ? '保存しています' : '表示名を保存する'}
        </button>
      </form>

      {demo ? (
        // デモではメールアドレスを変えられない(AC-007-15)
        <section className="sheet" aria-labelledby="email-title">
          <h2 id="email-title" className="sheet__title">
            メールアドレスの変更
          </h2>
          <p className="sheet__text">デモでは使えません。デモのメールアドレスは、外部に届かない架空のものです。</p>
        </section>
      ) : (
        <form ref={emailForm} className="sheet" onSubmit={(e) => void requestEmailChange(e)} noValidate aria-labelledby="email-title">
          <h2 id="email-title" className="sheet__title">
            メールアドレスの変更
          </h2>
          <p className="sheet__text">
            今のメールアドレス:<strong>{me.email}</strong>
            <br />
            新しいメールアドレスに確認メールを送ります。メールのリンクを開くまでは、今のメールアドレスのままです。
          </p>
          {emailSentTo !== null && (
            <Alert tone="info">
              {emailSentTo} に確認メールを送りました。15分以内に、メールのリンクをこの端末かログインした端末で開いてください。
            </Alert>
          )}
          <TextField
            label="新しいメールアドレス"
            type="email"
            name="new_email"
            autoComplete="email"
            inputMode="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            error={emailError}
          />
          <button type="submit" className="button button--primary" disabled={busy === 'email'}>
            {busy === 'email' ? '送信しています' : '確認メールを送る'}
          </button>
        </form>
      )}

      <section className="sheet" aria-labelledby="logout-title">
        <h2 id="logout-title" className="sheet__title">
          ログアウト
        </h2>
        <p className="sheet__text">この端末からログアウトします。次に使うときは、もう一度メールのリンクでログインします。</p>
        <button type="button" className="button button--secondary" onClick={() => void logOut()} disabled={busy === 'logout'}>
          {busy === 'logout' ? 'ログアウトしています' : 'ログアウトする'}
        </button>
      </section>

      <Link to="/" className="text-link">
        チームの画面に戻る
      </Link>
    </PageFrame>
  )
}
