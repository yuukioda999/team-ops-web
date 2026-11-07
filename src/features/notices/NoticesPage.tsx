import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { api, errorMessage, type Notice, type Team } from '../../api/client.ts'
import { Alert } from '../../components/Alert.tsx'
import { PageFrame } from '../../components/PageFrame.tsx'
import { Panel } from '../../components/Panel.tsx'
import { Loading } from '../auth/guards.tsx'
import { useMe } from '../auth/session-context.ts'
import { TeamPageGate } from '../invitations/TeamPageGate.tsx'
import { formatDateTime } from './notice-format.ts'

/** 自分宛てのお知らせの一覧(AC-005-14)。50件ずつ、古いものは続けて読み込む(AC-005-19)。未読に目印(AC-006-03) */
export function NoticesPage() {
  const { teamId = '' } = useParams()
  return (
    <TeamPageGate key={teamId} teamId={teamId} allowed={(team) => team.roles.length > 0} deniedText="お知らせは、チームのメンバーが見られます。">
      {(team) => <Notices team={team} />}
    </TeamPageGate>
  )
}

function Notices({ team }: { team: Team }) {
  const me = useMe()
  const notice = (useLocation().state as { notice?: string } | null)?.notice
  const [notices, setNotices] = useState<Notice[] | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [nextBefore, setNextBefore] = useState<number | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreFailure, setMoreFailure] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void api.GET('/api/teams/{team}/notices', { params: { path: { team: team.id } } }).then(({ data, error }) => {
      if (!active) return
      if (data !== undefined) {
        setNotices(data.notices)
        setNextBefore(data.next_before)
      } else setFailure(errorMessage(error))
    })
    return () => {
      active = false
    }
  }, [team.id])

  async function loadOlder() {
    if (nextBefore === null) return
    setLoadingMore(true)
    setMoreFailure(null)
    try {
      const { data, error } = await api.GET('/api/teams/{team}/notices', { params: { path: { team: team.id }, query: { before: nextBefore } } })
      if (data !== undefined) {
        setNotices([...(notices ?? []), ...data.notices])
        setNextBefore(data.next_before)
      } else setMoreFailure(errorMessage(error))
    } catch {
      setMoreFailure(errorMessage(null))
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <PageFrame title={team.name} pageTitle="お知らせ" home={`/teams/${team.id}`} signedInAs={me.email} account>
      <Panel tag="お知らせ" meta={notices !== null ? `${notices.length}件${nextBefore !== null ? '以上' : ''}` : undefined} title="お知らせ">
        <p className="panel__text">あなた宛てに届いたお知らせです。新しい順に並んでいます。</p>
      </Panel>
      {notice !== undefined && <Alert tone="info">{notice}</Alert>}
      {failure !== null && <Alert tone="error">{failure}</Alert>}
      {team.permissions.create_notices && (
        <section className="sheet" aria-labelledby="write-title">
          <h2 id="write-title" className="sheet__title">
            お知らせを送る
          </h2>
          <Link to={`/teams/${team.id}/notices/new`} className="button button--accent">
            お知らせを書く
          </Link>
          <Link to={`/teams/${team.id}/notices/scheduled`} className="button button--secondary">
            予約中のお知らせ
          </Link>
        </section>
      )}
      {notices === null && failure === null && <Loading />}
      {notices?.length === 0 && (
        <section className="sheet" aria-labelledby="empty">
          <h2 id="empty" className="sheet__title">
            まだお知らせはありません
          </h2>
          <p className="sheet__text">チームからのお知らせが届くと、ここに表示されます。メールでもお知らせします。</p>
        </section>
      )}
      {notices !== null && notices.length > 0 && (
        <ul className="notice-list" aria-label="お知らせ">
          {notices.map((n) => (
            <li key={n.id} className={n.unread ? 'notice-list__item notice-list__item--unread' : 'notice-list__item'}>
              <Link to={`/teams/${team.id}/notices/${n.id}`} className="notice-list__link">
                <span className="notice-list__title">
                  {n.unread && <span className="unread-mark">未読</span>}
                  {n.title}
                </span>
                <span className="notice-list__meta">
                  <time dateTime={n.published_at ?? undefined}>{formatDateTime(n.published_at)}</time>
                  {n.author_display_name !== null && ` / ${n.author_display_name}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {moreFailure !== null && <Alert tone="error">{moreFailure}</Alert>}
      {nextBefore !== null && (
        <button type="button" className="button button--secondary" disabled={loadingMore} onClick={() => void loadOlder()}>
          {loadingMore ? '読み込んでいます' : 'さらに古いお知らせを見る'}
        </button>
      )}
    </PageFrame>
  )
}
