import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { api, errorMessage, fieldErrors, withCsrfRetry, type Notice, type Team } from '../../api/client.ts'
import { Alert } from '../../components/Alert.tsx'
import { PageFrame } from '../../components/PageFrame.tsx'
import { Panel } from '../../components/Panel.tsx'
import { Loading } from '../auth/guards.tsx'
import { useMe } from '../auth/session-context.ts'
import { TeamPageGate } from '../invitations/TeamPageGate.tsx'
import { formatDateTime, targetLabel } from './notice-format.ts'

/** 予約中のお知らせ。代表・役員はチームのすべて、コーチは自分が作ったもの(AC-005-10、ADR-0017) */
export function ScheduledNoticesPage() {
  const { teamId = '' } = useParams()
  return (
    <TeamPageGate key={teamId} teamId={teamId} allowed={(team) => team.permissions.create_notices} deniedText="予約中のお知らせは、代表・役員・コーチが見られます。">
      {(team) => <ScheduledNotices team={team} />}
    </TeamPageGate>
  )
}

function ScheduledNotices({ team }: { team: Team }) {
  const me = useMe()
  const arrived = (useLocation().state as { notice?: string } | null)?.notice
  const [notices, setNotices] = useState<Notice[] | null>(null)
  const [notice, setNotice] = useState<string | null>(arrived ?? null)
  const [failure, setFailure] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void api.GET('/api/teams/{team}/notices/scheduled', { params: { path: { team: team.id } } }).then(({ data, error }) => {
      if (!active) return
      if (data !== undefined) setNotices(data.notices)
      else setFailure(errorMessage(error))
    })
    return () => {
      active = false
    }
  }, [team.id])

  function cancelled(n: Notice) {
    setNotices((current) => (current ?? []).filter((c) => c.id !== n.id))
    setNotice(`「${n.title}」の予約を取り消しました。メールは送られません。`)
  }

  return (
    <PageFrame title={team.name} pageTitle="予約中のお知らせ" home={`/teams/${team.id}`} signedInAs={me.email} account>
      <Panel tag="お知らせ" meta={notices !== null ? `${notices.length}件` : undefined} title="予約中のお知らせ">
        <p className="panel__text">
          {team.permissions.manage_all_notices ? 'チームの予約中のお知らせです。' : 'あなたが予約したお知らせです。'}指定した日時になると公開され、メールが送られます。
        </p>
      </Panel>
      {notice !== null && <Alert tone="info">{notice}</Alert>}
      {failure !== null && <Alert tone="error">{failure}</Alert>}
      {notices === null && failure === null && <Loading />}
      {notices?.length === 0 && (
        <section className="sheet" aria-labelledby="empty">
          <h2 id="empty" className="sheet__title">
            予約中のお知らせはありません
          </h2>
          <Link to={`/teams/${team.id}/notices/new`} className="button button--accent">
            お知らせを書く
          </Link>
        </section>
      )}
      {notices?.map((n) => <ScheduledItem key={n.id} team={team} notice={n} onCancelled={cancelled} />)}
      <Link to={`/teams/${team.id}/notices`} className="text-link">
        お知らせ一覧に戻る
      </Link>
    </PageFrame>
  )
}

function ScheduledItem({ team, notice, onCancelled }: { team: Team; notice: Notice; onCancelled: (n: Notice) => void }) {
  const [confirming, setConfirming] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const headingId = `scheduled-${notice.id}`

  async function cancel() {
    setBusy(true)
    const { response, error } = await withCsrfRetry(() =>
      api.DELETE('/api/teams/{team}/notices/{notice}', { params: { path: { team: team.id, notice: notice.id } } }),
    )
    setBusy(false)
    if (response.status === 204) onCancelled(notice)
    else setFailure(fieldErrors(error).notice?.[0] ?? errorMessage(error))
  }

  return (
    <section className="sheet" aria-labelledby={headingId}>
      <h2 id={headingId} className="sheet__title">
        {notice.title}
      </h2>
      <p className="sheet__text">
        {formatDateTime(notice.scheduled_at)}に送信 / 宛先:{targetLabel(notice.target)}
        {notice.author_display_name !== null && ` / ${notice.author_display_name}さんが作成`}
      </p>
      {failure !== null && <Alert tone="error">{failure}</Alert>}
      <Link to={`/teams/${team.id}/notices/${notice.id}/edit`} className="button button--secondary">
        編集する
      </Link>
      {confirming ? (
        <>
          <button type="button" className="button button--danger" onClick={() => void cancel()} disabled={busy}>
            予約を取り消す
          </button>
          <button type="button" className="button button--secondary" onClick={() => setConfirming(false)}>
            やめる
          </button>
        </>
      ) : (
        <button type="button" className="button button--secondary" onClick={() => setConfirming(true)}>
          取り消す
        </button>
      )}
    </section>
  )
}
