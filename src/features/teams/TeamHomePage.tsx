import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { api, type Team } from '../../api/client.ts'
import { Loading } from '../auth/guards.tsx'
import { PageFrame } from '../../components/PageFrame.tsx'
import { Panel } from '../../components/Panel.tsx'
import { useMe } from '../auth/session-context.ts'
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
      {(team.permissions.manage_invitation || team.permissions.review_join_requests) && (
        <section className="sheet" aria-labelledby="members-title">
          <h2 id="members-title" className="sheet__title">
            メンバー
          </h2>
          {team.permissions.manage_invitation && (
            <Link to={`/teams/${team.id}/invitation`} className="button button--accent">
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
    </PageFrame>
  )
}
