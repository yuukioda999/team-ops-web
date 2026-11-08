import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { api, errorMessage, fieldErrors, withCsrfRetry, type Sport } from '../../api/client.ts'
import { Alert } from '../../components/Alert.tsx'
import { PageFrame } from '../../components/PageFrame.tsx'
import { Panel } from '../../components/Panel.tsx'
import { TextField } from '../../components/TextField.tsx'
import { useFocusFirstInvalid } from '../../components/use-focus-first-invalid.ts'
import { useMe, useSession } from '../auth/session-context.ts'
import { SPORT_LABELS, SPORTS } from './sports.ts'

/** チームの作成。作った人が代表になる(AC-001-11・12)。 */
export function NewTeamPage() {
  const me = useMe()
  const { refresh } = useSession()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [sport, setSport] = useState<Sport>('soccer')
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const form = useRef<HTMLFormElement>(null)
  useFocusFirstInvalid(form, errors)

  async function create(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setErrors({})
    setError(null)
    const { data, response, error: body } = await withCsrfRetry(() => api.POST('/api/teams', { body: { name, sport } }))
    if (data !== undefined) {
      await refresh() // the team list in Me now includes the new team
      setBusy(false)
      navigate(`/teams/${data.id}`, { replace: true })
      return
    }
    setBusy(false)
    if (response.status === 422) {
      setErrors(fieldErrors(body))
    } else {
      setError(errorMessage(body))
    }
  }

  // デモではチームを作れない(AC-007-15)
  if (me.demo_team_id !== null) {
    return (
      <PageFrame title="チームを作成" pageTitle="チームを作成" signedInAs={me.email} account>
        <Panel tag="チーム" title="デモでは使えません">
          <p className="panel__text">デモでは新しいチームを作れません。用意したデモチームで、すべての機能を試せます。</p>
        </Panel>
        <Link to={`/teams/${me.demo_team_id}`} className="text-link">
          デモチームに戻る
        </Link>
      </PageFrame>
    )
  }

  return (
    <PageFrame title="チームを作成" pageTitle="チームを作成" signedInAs={me.email} account>
      <h1 className="visually-hidden">チームを作成</h1>
      {/* 6つ目のチームなど、項目に結びつかない理由(AC-001-12) */}
      {errors.team?.[0] !== undefined && <Alert tone="error">{errors.team[0]}</Alert>}
      {error !== null && <Alert tone="error">{error}</Alert>}
      <form ref={form} className="sheet" onSubmit={(e) => void create(e)} noValidate>
        <p className="sheet__text">作ったあなたが、このチームの代表になります。</p>
        <TextField
          label="チーム名"
          name="name"
          required
          maxLength={50}
          value={name}
          onChange={(e) => setName(e.target.value)}
          hint="50文字まで。例:あおば台FC U-10"
          error={errors.name?.[0]}
        />
        <fieldset className="choices" aria-describedby={errors.sport?.[0] !== undefined ? 'sport-error' : undefined}>
          <legend className="choices__legend">競技</legend>
          {SPORTS.map((value) => (
            <label key={value} className="choice">
              <input type="radio" name="sport" value={value} checked={sport === value} onChange={() => setSport(value)} />
              {SPORT_LABELS[value]}
            </label>
          ))}
        </fieldset>
        {errors.sport?.[0] !== undefined && (
          <p id="sport-error" className="field__error">
            {errors.sport[0]}
          </p>
        )}
        <button type="submit" className="button button--accent" disabled={busy}>
          {busy ? '作成しています' : 'チームを作成する'}
        </button>
      </form>
      <Link to="/" className="text-link">
        戻る
      </Link>
    </PageFrame>
  )
}
