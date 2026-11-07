import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { api, errorMessage, fieldErrors, withCsrfRetry, type Grade, type Guardian, type Player, type Team } from '../../api/client.ts'
import { Alert } from '../../components/Alert.tsx'
import { PageFrame } from '../../components/PageFrame.tsx'
import { Panel } from '../../components/Panel.tsx'
import { TextField } from '../../components/TextField.tsx'
import { Loading } from '../auth/guards.tsx'
import { useMe } from '../auth/session-context.ts'
import { TeamPageGate } from '../invitations/TeamPageGate.tsx'
import { GRADE_LABELS, GRADES, MAX_GUARDIANS } from './grades.ts'

/** 選手の登録(/players/new)と、編集・削除・保護者の紐づけ(/players/:playerId)。代表・役員だけ(AC-003-01〜07)。 */
export function PlayerPage() {
  const { teamId = '', playerId } = useParams()
  return (
    <TeamPageGate key={`${teamId}:${playerId ?? 'new'}`} teamId={teamId} allowed={(team) => team.permissions.manage_players}>
      {(team) => (playerId === undefined ? <NewPlayer team={team} /> : <EditPlayer team={team} playerId={Number(playerId)} />)}
    </TeamPageGate>
  )
}

type Values = { display_name: string; grade: Grade | ''; number: string }

function toBody(values: Values) {
  return {
    display_name: values.display_name,
    grade: values.grade as Grade,
    number: values.number === '' ? null : Number(values.number),
  }
}

function PlayerFields({ values, errors, onChange }: { values: Values; errors: Record<string, string[]>; onChange: (values: Values) => void }) {
  const gradeError = errors.grade?.[0]
  return (
    <>
      <TextField
        label="表示名"
        hint="30文字まで。本名でなくても、呼び名でかまいません。"
        value={values.display_name}
        maxLength={30}
        required
        autoComplete="off"
        error={errors.display_name?.[0]}
        onChange={(e) => onChange({ ...values, display_name: e.target.value })}
      />
      <div className="field">
        <label className="field__label" htmlFor="player-grade">
          学年
        </label>
        <select
          id="player-grade"
          className="field__input"
          value={values.grade}
          required
          aria-invalid={gradeError !== undefined ? true : undefined}
          aria-describedby={gradeError !== undefined ? 'player-grade-error' : undefined}
          onChange={(e) => onChange({ ...values, grade: e.target.value as Grade | '' })}
        >
          <option value="">選んでください</option>
          {GRADES.map((g) => (
            <option key={g} value={g}>
              {GRADE_LABELS[g]}
            </option>
          ))}
        </select>
        {gradeError !== undefined && (
          <p id="player-grade-error" className="field__error">
            {gradeError}
          </p>
        )}
      </div>
      <TextField
        label="背番号(任意)"
        hint="0〜999"
        inputMode="numeric"
        maxLength={3}
        value={values.number}
        error={errors.number?.[0]}
        onChange={(e) => onChange({ ...values, number: e.target.value.replace(/[^0-9]/g, '') })}
      />
    </>
  )
}

function NewPlayer({ team }: { team: Team }) {
  const me = useMe()
  const navigate = useNavigate()
  const [values, setValues] = useState<Values>({ display_name: '', grade: '', number: '' })
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (values.grade === '') {
      setErrors({ grade: ['学年を選んでください'] })
      return
    }
    setBusy(true)
    const { data, error, response } = await withCsrfRetry(() =>
      api.POST('/api/teams/{team}/players', { params: { path: { team: team.id } }, body: toBody(values) }),
    )
    setBusy(false)
    if (data !== undefined) {
      const notice = data.possible_duplicate
        ? `${data.player.display_name}さんを登録しました。同じ表示名・学年の選手がすでにいます。重複していないか、名簿で確かめてください。`
        : `${data.player.display_name}さんを登録しました。続けて保護者を紐づけられます。`
      navigate(`/teams/${team.id}/players/${data.player.id}`, { replace: true, state: { notice, duplicate: data.possible_duplicate } })
      return
    }
    const fields = fieldErrors(error)
    setErrors(fields)
    // 上限(AC-003-04)は項目ではなく、選手全体のエラー
    setFailure(fields.players?.[0] ?? (response.status === 422 ? null : errorMessage(error)))
  }

  return (
    <PageFrame title={team.name} pageTitle="選手を登録" home={`/teams/${team.id}`} signedInAs={me.email} account>
      <Panel tag="名簿" meta={team.name} title="選手を登録" />
      {failure !== null && <Alert tone="error">{failure}</Alert>}
      <form className="sheet" onSubmit={(e) => void submit(e)} noValidate aria-label="選手の情報">
        <PlayerFields values={values} errors={errors} onChange={setValues} />
        <button type="submit" className="button button--accent" disabled={busy}>
          登録する
        </button>
      </form>
      <Link to={`/teams/${team.id}/players`} className="text-link">
        名簿に戻る
      </Link>
    </PageFrame>
  )
}

function EditPlayer({ team, playerId }: { team: Team; playerId: number }) {
  const me = useMe()
  const navigate = useNavigate()
  const location = useLocation()
  const arrived = location.state as { notice?: string; duplicate?: boolean } | null
  const [player, setPlayer] = useState<Player | null>(null)
  const [missing, setMissing] = useState(false)
  const [values, setValues] = useState<Values>({ display_name: '', grade: '', number: '' })
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [notice, setNotice] = useState<string | null>(arrived?.notice ?? null)
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    let active = true
    void api.GET('/api/teams/{team}/players/{player}', { params: { path: { team: team.id, player: playerId } } }).then(({ data, error, response }) => {
      if (!active) return
      if (data !== undefined) {
        setPlayer(data.player)
        setValues({ display_name: data.player.display_name, grade: data.player.grade, number: data.player.number === null ? '' : String(data.player.number) })
      } else if (response.status === 404) setMissing(true)
      else setFailure(errorMessage(error))
    })
    return () => {
      active = false
    }
  }, [team.id, playerId])

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setNotice(null)
    const { data, error } = await withCsrfRetry(() =>
      api.PATCH('/api/teams/{team}/players/{player}', { params: { path: { team: team.id, player: playerId } }, body: toBody(values) }),
    )
    setBusy(false)
    if (data !== undefined) {
      setPlayer(data.player)
      setErrors({})
      setFailure(null)
      setNotice('保存しました。')
    } else {
      setErrors(fieldErrors(error))
      setFailure(errorMessage(error))
    }
  }

  async function remove() {
    setBusy(true)
    const { response, error } = await withCsrfRetry(() =>
      api.DELETE('/api/teams/{team}/players/{player}', { params: { path: { team: team.id, player: playerId } } }),
    )
    setBusy(false)
    if (response.status === 204 || response.status === 404) {
      navigate(`/teams/${team.id}/players`, { replace: true, state: { notice: `${player?.display_name ?? '選手'}さんを名簿から削除しました。` } })
    } else setFailure(errorMessage(error))
  }

  if (missing) {
    return (
      <PageFrame title={team.name} pageTitle="選手が見つかりません" home={`/teams/${team.id}`} signedInAs={me.email} account>
        <Panel tag="名簿" title="選手が見つかりません">
          <p className="panel__text">すでに削除されたか、このチームの選手ではありません。</p>
          <Link to={`/teams/${team.id}/players`} className="button button--on-panel">
            名簿に戻る
          </Link>
        </Panel>
      </PageFrame>
    )
  }

  return (
    <PageFrame title={team.name} pageTitle={player?.display_name ?? '選手'} home={`/teams/${team.id}`} signedInAs={me.email} account>
      <Panel tag="名簿" meta={player !== null ? GRADE_LABELS[player.grade] : undefined} title={player?.display_name ?? '選手'} />
      {notice !== null && <Alert tone="info">{notice}</Alert>}
      {failure !== null && <Alert tone="error">{failure}</Alert>}
      {player === null ? (
        failure === null && <Loading />
      ) : (
        <>
          <form className="sheet" onSubmit={(e) => void save(e)} noValidate aria-labelledby="edit-title">
            <h2 id="edit-title" className="sheet__title">
              選手の情報
            </h2>
            <PlayerFields values={values} errors={errors} onChange={setValues} />
            <button type="submit" className="button button--accent" disabled={busy}>
              保存する
            </button>
          </form>
          <GuardianForm team={team} player={player} onSaved={(p, message) => (setPlayer(p), setNotice(message), setFailure(null))} onError={setFailure} />
          <section className="sheet" aria-labelledby="delete-title">
            <h2 id="delete-title" className="sheet__title">
              名簿から削除する
            </h2>
            <p className="sheet__text">削除すると、保護者との紐づけも外れます。元には戻せません。</p>
            {confirmDelete ? (
              <>
                <button type="button" className="button button--danger" onClick={() => void remove()} disabled={busy}>
                  {player.display_name}さんを削除する
                </button>
                <button type="button" className="button button--secondary" onClick={() => setConfirmDelete(false)}>
                  やめる
                </button>
              </>
            ) : (
              <button type="button" className="button button--secondary" onClick={() => setConfirmDelete(true)}>
                削除する
              </button>
            )}
          </section>
        </>
      )}
      <Link to={`/teams/${team.id}/players`} className="text-link">
        名簿に戻る
      </Link>
    </PageFrame>
  )
}

function GuardianForm({
  team,
  player,
  onSaved,
  onError,
}: {
  team: Team
  player: Player
  onSaved: (player: Player, message: string) => void
  onError: (message: string) => void
}) {
  const [candidates, setCandidates] = useState<Guardian[] | null>(null)
  const [selected, setSelected] = useState<number[]>(player.guardians.map((g) => g.membership_id))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    void api.GET('/api/teams/{team}/guardian-candidates', { params: { path: { team: team.id } } }).then(({ data, error }) => {
      if (!active) return
      if (data !== undefined) setCandidates(data.candidates)
      else onError(errorMessage(error))
    })
    return () => {
      active = false
    }
  }, [team.id, onError])

  function toggle(id: number, checked: boolean) {
    setSelected((current) => (checked ? [...current, id] : current.filter((c) => c !== id)))
  }

  async function save() {
    setBusy(true)
    const { data, error } = await withCsrfRetry(() =>
      api.PUT('/api/teams/{team}/players/{player}/guardians', {
        params: { path: { team: team.id, player: player.id } },
        body: { membership_ids: selected },
      }),
    )
    setBusy(false)
    if (data !== undefined) onSaved(data.player, '保護者の紐づけを保存しました。')
    else onError(fieldErrors(error).membership_ids?.[0] ?? errorMessage(error))
  }

  const full = selected.length >= MAX_GUARDIANS
  return (
    <section className="sheet" aria-labelledby="guardians-title">
      <h2 id="guardians-title" className="sheet__title">
        保護者
      </h2>
      <p className="sheet__text">保護者の役割を持つメンバーから、{MAX_GUARDIANS}人まで選べます。外しても、メンバーはチームに残ります。</p>
      {candidates === null ? (
        <Loading />
      ) : candidates.length === 0 ? (
        <p className="sheet__text">
          保護者の役割を持つメンバーがまだいません。
          {team.permissions.manage_invitation && (
            <>
              {' '}
              <Link to={`/teams/${team.id}/invitation`}>メンバーを招待する</Link>
            </>
          )}
        </p>
      ) : (
        <>
          <fieldset className="guardian-list">
            <legend className="choices__legend">紐づける保護者(選択中 {selected.length}人)</legend>
            {candidates.map((c) => {
              const checked = selected.includes(c.membership_id)
              return (
                <label key={c.membership_id} className="guardian-list__item">
                  <input type="checkbox" checked={checked} disabled={!checked && full} onChange={(e) => toggle(c.membership_id, e.target.checked)} />
                  {c.display_name ?? '(表示名なし)'}
                </label>
              )
            })}
          </fieldset>
          {full && <p className="field__hint">{MAX_GUARDIANS}人まで選べます。別の人を選ぶときは、先に1人外してください。</p>}
          <button type="button" className="button button--secondary" onClick={() => void save()} disabled={busy}>
            保護者の紐づけを保存する
          </button>
        </>
      )}
    </section>
  )
}
