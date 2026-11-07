import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { api, errorMessage, type Notice, type Team } from '../../api/client.ts'
import { Alert } from '../../components/Alert.tsx'
import { PageFrame } from '../../components/PageFrame.tsx'
import { Panel } from '../../components/Panel.tsx'
import { Loading } from '../auth/guards.tsx'
import { useMe } from '../auth/session-context.ts'
import { TeamPageGate } from '../invitations/TeamPageGate.tsx'
import { Linkified } from './Linkified.tsx'
import { formatDateTime, targetLabel } from './notice-format.ts'

/** お知らせ1件。宛先でなければ見つからない表示(AC-005-15・16) */
export function NoticePage() {
  const { teamId = '', noticeId = '' } = useParams()
  return (
    <TeamPageGate key={`${teamId}:${noticeId}`} teamId={teamId} allowed={(team) => team.roles.length > 0} deniedText="お知らせは、チームのメンバーが見られます。">
      {(team) => <NoticeDetail team={team} noticeId={Number(noticeId)} />}
    </TeamPageGate>
  )
}

function NoticeDetail({ team, noticeId }: { team: Team; noticeId: number }) {
  const me = useMe()
  const [notice, setNotice] = useState<Notice | null>(null)
  const [missing, setMissing] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void api.GET('/api/teams/{team}/notices/{notice}', { params: { path: { team: team.id, notice: noticeId } } }).then(({ data, error, response }) => {
      if (!active) return
      if (data !== undefined) setNotice(data.notice)
      else if (response.status === 404) setMissing(true)
      else setFailure(errorMessage(error))
    })
    return () => {
      active = false
    }
  }, [team.id, noticeId])

  if (missing) {
    return (
      <PageFrame title={team.name} pageTitle="お知らせが見つかりません" home={`/teams/${team.id}`} signedInAs={me.email} account>
        <Panel tag="お知らせ" title="お知らせが見つかりません">
          <p className="panel__text">このお知らせは存在しないか、あなた宛てではありません。</p>
          <Link to={`/teams/${team.id}/notices`} className="button button--on-panel">
            お知らせ一覧に戻る
          </Link>
        </Panel>
      </PageFrame>
    )
  }

  return (
    <PageFrame title={team.name} pageTitle={notice?.title ?? 'お知らせ'} home={`/teams/${team.id}`} signedInAs={me.email} account>
      {failure !== null && <Alert tone="error">{failure}</Alert>}
      {notice === null ? (
        failure === null && <Loading />
      ) : (
        <>
          <Panel tag="お知らせ" meta={formatDateTime(notice.published_at)} title={notice.title}>
            <p className="panel__text">
              {notice.author_display_name ?? '(退会したメンバー)'}さんから / 宛先:{targetLabel(notice.target)}
            </p>
          </Panel>
          <article className="sheet" aria-label="本文">
            <Linkified text={notice.body} />
          </article>
        </>
      )}
      <Link to={`/teams/${team.id}/notices`} className="text-link">
        お知らせ一覧に戻る
      </Link>
    </PageFrame>
  )
}
