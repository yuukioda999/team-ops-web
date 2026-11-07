import { useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { api, errorMessage, fieldErrors, withCsrfRetry, type Sport, type Team } from '../../api/client.ts'
import { Alert } from '../../components/Alert.tsx'
import { PageFrame } from '../../components/PageFrame.tsx'
import { Panel } from '../../components/Panel.tsx'
import { TextField } from '../../components/TextField.tsx'
import { useFocusFirstInvalid } from '../../components/use-focus-first-invalid.ts'
import { useMe, useSession } from '../auth/session-context.ts'
import { TeamPageGate } from '../invitations/TeamPageGate.tsx'
import { SPORT_LABELS, SPORTS } from './sports.ts'

/** チーム名・競技の変更。代表だけ(AC-004-11) */
export function TeamSettingsPage() {
  const { teamId = '' } = useParams()
  return (
    <TeamPageGate key={teamId} teamId={teamId} allowed={(team) => team.permissions.update_team} deniedText="チーム名と競技は、チームの代表だけが変えられます。">
      {(team) => <TeamSettings team={team} />}
    </TeamPageGate>
  )
}

function TeamSettings({ team }: { team: Team }) {
  const me = useMe()
  const { refresh } = useSession()
  const [current, setCurrent] = useState(team)
  const [name, setName] = useState(team.name)
  const [sport, setSport] = useState<Sport>(team.sport)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const form = useRef<HTMLFormElement>(null)
  useFocusFirstInvalid(form, errors)

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setErrors({})
    setFailure(null)
    setNotice(null)
    const { data, response, error } = await withCsrfRetry(() =>
      api.PATCH('/api/teams/{team}', { params: { path: { team: team.id } }, body: { name, sport } }),
    )
    if (data !== undefined) {
      await refresh() // チームの切り替えに出る名前も新しくする
      setBusy(false)
      setCurrent(data)
      setName(data.name)
      setNotice('保存しました。メンバー全員の画面に、新しいチーム名が表示されます。')
      return
    }
    setBusy(false)
    if (response.status === 422) setErrors(fieldErrors(error))
    else setFailure(errorMessage(error))
  }

  return (
    <PageFrame title={current.name} pageTitle="チームの設定" home={`/teams/${team.id}`} signedInAs={me.email} account>
      <Panel tag="チームの設定" meta={SPORT_LABELS[current.sport]} title={current.name} />
      {notice !== null && <Alert tone="info">{notice}</Alert>}
      {failure !== null && <Alert tone="error">{failure}</Alert>}
      <form ref={form} className="sheet" onSubmit={(e) => void save(e)} noValidate aria-label="チームの設定">
        <TextField
          label="チーム名"
          name="name"
          required
          maxLength={50}
          value={name}
          onChange={(e) => setName(e.target.value)}
          hint="50文字まで"
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
          {busy ? '保存しています' : '保存する'}
        </button>
      </form>
      <Link to={`/teams/${team.id}`} className="text-link">
        チームのホームに戻る
      </Link>
    </PageFrame>
  )
}
