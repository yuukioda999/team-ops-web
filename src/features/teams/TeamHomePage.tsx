import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { api, type Notice, type Team } from '../../api/client.ts'
import { formatDateTime } from '../notices/notice-format.ts'
import { Loading } from '../auth/guards.tsx'
import { PageFrame } from '../../components/PageFrame.tsx'
import { Panel } from '../../components/Panel.tsx'
import { useMe } from '../auth/session-context.ts'
import { canOpenRoster } from '../players/grades.ts'
import { rolesLabel, SPORT_LABELS } from './sports.ts'
import { TeamSwitcher } from './TeamSwitcher.tsx'

type State = { status: 'loading' } | { status: 'ready'; team: Team } | { status: 'not-found' } | { status: 'error' }

/**
 * チームのホーム。URL のチームIDでチームを決め(ADR-0009)、所属していなければ
 * 存在しない場合と同じ表示にする(AC-000-01)。
 */
export function TeamHomePage() {
  const { teamId = '' } = useParams()
  // A new team ID starts from a fresh "loading" state
  return <TeamHome key={teamId} teamId={teamId} />
}

function TeamHome({ teamId }: { teamId: string }) {
  const me = useMe()
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let active = true
    void api.GET('/api/teams/{team}', { params: { path: { team: teamId } } }).then(({ data, response }) => {
      if (!active) return
      if (data !== undefined) setState({ status: 'ready', team: data })
      else setState({ status: response.status === 404 ? 'not-found' : 'error' })
    })
    return () => {
      active = false
    }
  }, [teamId])

  if (state.status === 'loading') {
    return <Loading />
  }

  if (state.status !== 'ready') {
    return (
      <PageFrame
        title="チーム運営"
        pageTitle={state.status === 'not-found' ? 'チームが見つかりません' : 'チームを読み込めませんでした'}
        signedInAs={me.email}
        account
      >
        <Panel tag="チーム" title={state.status === 'not-found' ? 'チームが見つかりません' : 'チームを読み込めませんでした'}>
          <p className="panel__text">
            {state.status === 'not-found'
              ? 'このチームは存在しないか、あなたが所属していないチームです。'
              : '通信に失敗しました。時間をおいてもう一度開いてください。'}
          </p>
          <Link to="/" className="button button--accent">
            自分のチームを開く
          </Link>
        </Panel>
      </PageFrame>
    )
  }

  const { team } = state
  return (
    <PageFrame
      title={team.name}
      pageTitle={team.name}
      home={`/teams/${team.id}`}
      signedInAs={me.email}
      account
      headerExtra={<TeamSwitcher teams={me.teams} currentId={team.id} />}
    >
      <Panel tag={SPORT_LABELS[team.sport]} meta={`あなたの役割:${rolesLabel(team.roles)}`} title={team.name} label="チーム">
        <p className="panel__text">
          {me.display_name}さん、ようこそ。{me.teams.length > 1 ? `${me.teams.length}チームに所属しています。右上のボタンで切り替えられます。` : ''}
        </p>
      </Panel>
      <section className="sheet" aria-labelledby="notices-title">
        <h2 id="notices-title" className="sheet__title">
          お知らせ
        </h2>
        <LatestNotices teamId={team.id} />
        <Link to={`/teams/${team.id}/notices`} className="button button--accent">
          お知らせを見る
        </Link>
        {team.permissions.create_notices && (
          <Link to={`/teams/${team.id}/notices/new`} className="button button--secondary">
            お知らせを書く
          </Link>
        )}
      </section>
      {canOpenRoster(team) && (
        <section className="sheet" aria-labelledby="roster-title">
          <h2 id="roster-title" className="sheet__title">
            名簿
          </h2>
          <Link to={`/teams/${team.id}/players`} className="button button--accent">
            {team.permissions.view_all_players ? '名簿を見る' : 'お子さんの情報を見る'}
          </Link>
        </section>
      )}
      {(team.permissions.manage_invitation || team.permissions.review_join_requests || team.permissions.view_members) && (
        <section className="sheet" aria-labelledby="members-title">
          <h2 id="members-title" className="sheet__title">
            メンバー
          </h2>
          {team.permissions.view_members && (
            <Link to={`/teams/${team.id}/members`} className="button button--accent">
              メンバー一覧
            </Link>
          )}
          {team.permissions.manage_invitation && (
            <Link to={`/teams/${team.id}/invitation`} className="button button--secondary">
              メンバーを招待する
            </Link>
          )}
          {team.permissions.review_join_requests && (
            <Link to={`/teams/${team.id}/join-requests`} className="button button--secondary">
              承認待ちの申請を見る
            </Link>
          )}
        </section>
      )}
      {(team.permissions.update_team || team.permissions.view_audit_logs) && (
        <section className="sheet" aria-labelledby="manage-title">
          <h2 id="manage-title" className="sheet__title">
            チームの管理
          </h2>
          {team.permissions.update_team && (
            <Link to={`/teams/${team.id}/settings`} className="button button--secondary">
              チーム名・競技を変える
            </Link>
          )}
          {team.permissions.view_audit_logs && (
            <Link to={`/teams/${team.id}/audit-logs`} className="button button--secondary">
              監査ログを見る
            </Link>
          )}
        </section>
      )}
    </PageFrame>
  )
}

/** 新しいお知らせ3件。読み込めなかったときは一覧への導線だけを残す */
function LatestNotices({ teamId }: { teamId: string }) {
  const [notices, setNotices] = useState<Notice[] | null>(null)

  useEffect(() => {
    let active = true
    void api
      .GET('/api/teams/{team}/notices', { params: { path: { team: teamId } } })
      .then(({ data }) => {
        if (active && data !== undefined) setNotices(data.notices.slice(0, 3))
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [teamId])

  if (notices === null) return null
  if (notices.length === 0) return <p className="sheet__text">まだお知らせはありません。</p>
  return (
    <ul className="notice-list" aria-label="新しいお知らせ">
      {notices.map((n) => (
        <li key={n.id} className={n.unread ? 'notice-list__item notice-list__item--unread' : 'notice-list__item'}>
          <Link to={`/teams/${teamId}/notices/${n.id}`} className="notice-list__link">
            <span className="notice-list__title">
              {n.unread && <span className="unread-mark">未読</span>}
              {n.title}
            </span>
            <span className="notice-list__meta">
              <time dateTime={n.published_at ?? undefined}>{formatDateTime(n.published_at)}</time>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
