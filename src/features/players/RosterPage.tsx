import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { api, errorMessage, type Grade, type Player, type Team } from '../../api/client.ts'
import { Alert } from '../../components/Alert.tsx'
import { PageFrame } from '../../components/PageFrame.tsx'
import { Panel } from '../../components/Panel.tsx'
import { Loading } from '../auth/guards.tsx'
import { useMe } from '../auth/session-context.ts'
import { TeamPageGate } from '../invitations/TeamPageGate.tsx'
import { canOpenRoster, GRADE_LABELS, GRADES } from './grades.ts'

/** 名簿(AC-003-08・09・12)。保護者には自分に紐づく選手だけが返ってくる。 */
export function RosterPage() {
  const { teamId = '' } = useParams()
  return (
    <TeamPageGate key={teamId} teamId={teamId} allowed={canOpenRoster} deniedText="名簿は、代表・役員・コーチと、選手に紐づく保護者が見られます。">
      {(team) => <Roster team={team} />}
    </TeamPageGate>
  )
}

type Filter = { grade: Grade | ''; number: string }

function Roster({ team }: { team: Team }) {
  const me = useMe()
  const notice = (useLocation().state as { notice?: string } | null)?.notice
  const [filter, setFilter] = useState<Filter>({ grade: '', number: '' })
  const [draft, setDraft] = useState<Filter>(filter)
  const [players, setPlayers] = useState<Player[] | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const viewAll = team.permissions.view_all_players
  const manage = team.permissions.manage_players

  useEffect(() => {
    let active = true
    const query = {
      grade: filter.grade === '' ? undefined : filter.grade,
      number: filter.number === '' ? undefined : Number(filter.number),
    }
    void api.GET('/api/teams/{team}/players', { params: { path: { team: team.id }, query } }).then(({ data, error }) => {
      if (!active) return
      if (data !== undefined) {
        setPlayers(data.players)
        setFailure(null)
      } else setFailure(errorMessage(error))
    })
    return () => {
      active = false
    }
  }, [team.id, filter])

  function applyFilter(event: FormEvent) {
    event.preventDefault()
    setPlayers(null)
    setFilter(draft)
  }

  const filtered = filter.grade !== '' || filter.number !== ''
  return (
    <PageFrame title={team.name} pageTitle="名簿" home={`/teams/${team.id}`} signedInAs={me.email} account>
      <Panel tag="名簿" meta={players !== null ? `${players.length}人` : undefined} title={viewAll ? '選手の名簿' : 'あなたのお子さん'}>
        <p className="panel__text">
          {viewAll
            ? '全選手の学年・背番号と、紐づいている保護者が見られます。'
            : 'あなたに紐づいている選手だけが表示されます。他のご家庭の情報は表示されません。'}
        </p>
      </Panel>
      {notice !== undefined && <Alert tone="info">{notice}</Alert>}
      {failure !== null && <Alert tone="error">{failure}</Alert>}
      {manage && (
        <section className="sheet" aria-labelledby="roster-actions">
          <h2 id="roster-actions" className="sheet__title">
            選手を追加する
          </h2>
          <Link to={`/teams/${team.id}/players/new`} className="button button--accent">
            選手を登録する
          </Link>
          <Link to={`/teams/${team.id}/players/import`} className="button button--secondary">
            CSVで一括登録する
          </Link>
        </section>
      )}
      {viewAll && (
        <form className="sheet roster-filter" onSubmit={applyFilter} aria-labelledby="filter-title">
          <h2 id="filter-title" className="sheet__title">
            絞り込み
          </h2>
          <div className="roster-filter__fields">
            <div className="field">
              <label className="field__label" htmlFor="filter-grade">
                学年
              </label>
              <select id="filter-grade" className="field__input" value={draft.grade} onChange={(e) => setDraft({ ...draft, grade: e.target.value as Grade | '' })}>
                <option value="">すべて</option>
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {GRADE_LABELS[g]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="filter-number">
                背番号
              </label>
              <input
                id="filter-number"
                className="field__input"
                inputMode="numeric"
                pattern="[0-9]{1,3}"
                maxLength={3}
                value={draft.number}
                onChange={(e) => setDraft({ ...draft, number: e.target.value.replace(/[^0-9]/g, '') })}
              />
            </div>
          </div>
          <button type="submit" className="button button--secondary">
            絞り込む
          </button>
        </form>
      )}
      {players === null && failure === null && <Loading />}
      {players?.length === 0 && (
        <section className="sheet" aria-labelledby="empty">
          <h2 id="empty" className="sheet__title">
            {filtered ? '条件に合う選手はいません' : viewAll ? 'まだ選手が登録されていません' : '紐づいている選手はいません'}
          </h2>
          <p className="sheet__text">
            {filtered
              ? '学年や背番号を変えて、もう一度絞り込んでください。'
              : viewAll
                ? manage
                  ? '選手を1人ずつ登録するか、CSVで一括登録してください。'
                  : '代表・役員が選手を登録すると、ここに表示されます。'
                : 'お子さんとの紐づけは、チームの代表・役員が行います。'}
          </p>
        </section>
      )}
      {players !== null && players.length > 0 && (
        <ul className="roster" aria-label="選手">
          {players.map((player) => (
            <li key={player.id} className="roster__item">
              <span className="roster__number score" aria-label={player.number === null ? '背番号なし' : `背番号${player.number}`}>
                {player.number ?? '-'}
              </span>
              <span className="roster__body">
                <span className="roster__name">
                  {manage ? <Link to={`/teams/${team.id}/players/${player.id}`}>{player.display_name}</Link> : player.display_name}
                </span>
                <span className="roster__meta">
                  {GRADE_LABELS[player.grade]}
                  {' / 保護者:'}
                  {player.guardians.length === 0 ? '未登録' : player.guardians.map((g) => g.display_name ?? '(表示名なし)').join('、')}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </PageFrame>
  )
}
