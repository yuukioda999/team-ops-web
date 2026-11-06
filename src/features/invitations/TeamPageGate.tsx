import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { Team } from '../../api/client.ts'
import { PageFrame } from '../../components/PageFrame.tsx'
import { Panel } from '../../components/Panel.tsx'
import { Loading } from '../auth/guards.tsx'
import { useMe } from '../auth/session-context.ts'
import { useTeam } from '../teams/use-team.ts'

/**
 * A team page that only some roles may use. Loads the team, then shows the page,
 * "not found" (not a member, AC-000-01) or "no permission" (AC-002-04).
 */
export function TeamPageGate({
  teamId,
  allowed,
  children,
}: {
  teamId: string
  allowed: (team: Team) => boolean
  children: (team: Team) => ReactNode
}) {
  const me = useMe()
  const state = useTeam(teamId)

  if (state.status === 'loading') return <Loading />

  if (state.status !== 'ready' || !allowed(state.team)) {
    const title =
      state.status === 'ready' ? 'この画面を開く権限がありません' : state.status === 'not-found' ? 'チームが見つかりません' : 'チームを読み込めませんでした'
    const text =
      state.status === 'ready'
        ? 'この画面は、チームの代表と役員だけが使えます。'
        : state.status === 'not-found'
          ? 'このチームは存在しないか、あなたが所属していないチームです。'
          : '通信に失敗しました。時間をおいてもう一度開いてください。'
    return (
      <PageFrame title="チーム運営" pageTitle={title} signedInAs={me.email} account>
        <Panel tag="チーム" title={title}>
          <p className="panel__text">{text}</p>
          <Link to={state.status === 'ready' ? `/teams/${teamId}` : '/'} className="button button--on-panel">
            チームのホームに戻る
          </Link>
        </Panel>
      </PageFrame>
    )
  }

  return children(state.team)
}
