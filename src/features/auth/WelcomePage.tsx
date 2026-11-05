import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { api, errorMessage, fieldErrors, withCsrfRetry } from '../../api/client.ts'
import { Alert } from '../../components/Alert.tsx'
import { PageFrame } from '../../components/PageFrame.tsx'
import { Panel } from '../../components/Panel.tsx'
import { TextField } from '../../components/TextField.tsx'
import { useFocusFirstInvalid } from '../../components/use-focus-first-invalid.ts'
import { takeReturnTo } from './return-to.ts'
import { useMe, useSession } from './session-context.ts'

/** 初回ログイン後の表示名の入力。入力すると登録が完了する(AC-001-08)。 */
export function WelcomePage() {
  const me = useMe()
  const { setMe } = useSession()
  const navigate = useNavigate()
  const [name, setName] = useState(me.display_name ?? '')
  const [nameError, setNameError] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const form = useRef<HTMLFormElement>(null)
  useFocusFirstInvalid(form, nameError)

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setNameError(undefined)
    setError(null)
    const { data, response, error: body } = await withCsrfRetry(() => api.PATCH('/api/me', { body: { display_name: name } }))
    setBusy(false)
    if (data !== undefined) {
      setMe(data)
      navigate(takeReturnTo() ?? '/', { replace: true })
    } else if (response.status === 422) {
      setNameError(fieldErrors(body).display_name?.[0] ?? errorMessage(body))
    } else {
      setError(errorMessage(body))
    }
  }

  return (
    <PageFrame title="チーム運営" pageTitle="表示名の登録" signedInAs={me.email}>
      <Panel tag="はじめまして" meta="登録はあと少しです" title="表示名を登録してください">
        <p className="panel__text">チームのメンバーに表示される名前です。あとから変更できます。</p>
      </Panel>
      {error !== null && <Alert tone="error">{error}</Alert>}
      <form ref={form} className="sheet" onSubmit={(e) => void save(e)} noValidate>
        <TextField
          label="表示名"
          name="display_name"
          autoComplete="name"
          required
          maxLength={30}
          value={name}
          onChange={(e) => setName(e.target.value)}
          hint="30文字まで。例:山田 花子"
          error={nameError}
        />
        <button type="submit" className="button button--accent" disabled={busy}>
          {busy ? '登録しています' : '登録する'}
        </button>
      </form>
    </PageFrame>
  )
}
