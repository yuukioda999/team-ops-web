import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import {
  api,
  errorMessage,
  withCsrfRetry,
  type NoticeDeliveryStatus,
  type NoticeFailedRecipient,
  type NoticeRecipientName,
  type Team,
} from '../../api/client.ts'
import { Alert } from '../../components/Alert.tsx'
import { PageFrame } from '../../components/PageFrame.tsx'
import { Panel } from '../../components/Panel.tsx'
import { Loading } from '../auth/guards.tsx'
import { useMe } from '../auth/session-context.ts'
import { TeamPageGate } from '../invitations/TeamPageGate.tsx'
import { deliveryReasonLabel, formatDateTime } from './notice-format.ts'

/**
 * 既読・配信状況と再通知(AC-006-04〜07・11〜15)。代表・役員、または作成者のコーチ。
 * 誰が見られるかは API が決める(403 なら権限がない表示)。
 */
export function NoticeStatusPage() {
  const { teamId = '', noticeId = '' } = useParams()
  return (
    <TeamPageGate
      key={`${teamId}:${noticeId}`}
      teamId={teamId}
      allowed={(team) => team.permissions.create_notices}
      deniedText="配信状況は、代表・役員と、お知らせを作成したコーチが見られます。"
    >
      {(team) => <NoticeStatus team={team} noticeId={Number(noticeId)} />}
    </TeamPageGate>
  )
}

type Loaded = {
  status: NoticeDeliveryStatus
  unread: NoticeRecipientName[]
  /** チームを抜けた人の人数(表示名は返らない) */
  formerUnread: number
  failures: NoticeFailedRecipient[]
  formerFailures: number
}

type Result = { kind: 'ready'; data: Loaded } | { kind: 'missing' } | { kind: 'denied' } | { kind: 'failed'; message: string }

async function load(teamId: string, noticeId: number): Promise<Result> {
  const params = { params: { path: { team: teamId, notice: noticeId } } }
  // お知らせの詳細は開かない(開くと既読になる)。題名は状況と一緒に返る
  const [status, unread, failures] = await Promise.all([
    api.GET('/api/teams/{team}/notices/{notice}/status', params),
    api.GET('/api/teams/{team}/notices/{notice}/status/unread', params),
    api.GET('/api/teams/{team}/notices/{notice}/status/failures', params),
  ])
  if (status.response.status === 404) return { kind: 'missing' }
  if (status.response.status === 403) return { kind: 'denied' }
  if (status.data === undefined || unread.data === undefined || failures.data === undefined) {
    return { kind: 'failed', message: errorMessage(status.error ?? unread.error ?? failures.error) }
  }
  return {
    kind: 'ready',
    data: {
      status: status.data.status,
      unread: unread.data.members,
      formerUnread: unread.data.former_members,
      failures: failures.data.members,
      formerFailures: failures.data.former_members,
    },
  }
}

function NoticeStatus({ team, noticeId }: { team: Team; noticeId: number }) {
  const me = useMe()
  const [result, setResult] = useState<Result | null>(null)
  const [reload, setReload] = useState(0)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null)

  useEffect(() => {
    let active = true
    load(team.id, noticeId)
      .then((r) => {
        if (active) setResult(r)
      })
      .catch(() => {
        if (active) setResult({ kind: 'failed', message: errorMessage(null) })
      })
    return () => {
      active = false
    }
  }, [team.id, noticeId, reload])

  async function remind() {
    setSending(true)
    setMessage(null)
    try {
      const { data, error } = await withCsrfRetry(() =>
        api.POST('/api/teams/{team}/notices/{notice}/reminders', { params: { path: { team: team.id, notice: noticeId } } }),
      )
      if (data !== undefined) {
        const { sent, excluded } = data.reminder
        setMessage({
          tone: 'info',
          text: `${sent}人に再通知しました。${excluded > 0 ? `${excluded}人はメールが届かないアドレスなどのため送っていません。` : ''}`,
        })
      } else {
        const reason = (error as { errors?: Record<string, string[]> } | undefined)?.errors?.reminder?.[0]
        setMessage({ tone: 'error', text: reason ?? errorMessage(error) })
      }
    } catch {
      setMessage({ tone: 'error', text: errorMessage(null) })
    } finally {
      setSending(false)
      setReload((n) => n + 1)
    }
  }

  const back = (
    <Link to={`/teams/${team.id}/notices/${noticeId}`} className="text-link">
      お知らせに戻る
    </Link>
  )

  if (result === null) {
    return (
      <PageFrame title={team.name} pageTitle="配信状況" home={`/teams/${team.id}`} signedInAs={me.email} account>
        <Loading />
      </PageFrame>
    )
  }
  if (result.kind !== 'ready') {
    const [title, text] =
      result.kind === 'missing'
        ? ['配信状況が見つかりません', 'このお知らせは存在しないか、まだ送信されていません。']
        : result.kind === 'denied'
          ? ['この画面を開く権限がありません', '配信状況は、代表・役員と、お知らせを作成したコーチが見られます。']
          : ['配信状況を読み込めませんでした', result.message]
    return (
      <PageFrame title={team.name} pageTitle={title} home={`/teams/${team.id}`} signedInAs={me.email} account>
        <Panel tag="配信状況" title={title}>
          <p className="panel__text">{text}</p>
        </Panel>
        {back}
      </PageFrame>
    )
  }

  const { status, unread, formerUnread, failures, formerFailures } = result.data
  const title = status.title
  const reminders = status.reminders
  const unreadMembers = status.unread_members

  return (
    <PageFrame title={team.name} pageTitle={`配信状況:${title}`} home={`/teams/${team.id}`} signedInAs={me.email} account>
      <Panel tag="配信状況" meta={status.state === 'sending' ? '送信中' : 'メールの送信は終わりました'} title={title}>
        <div className="readboard" aria-label={`宛先${status.recipients}人のうち、既読${status.read}人、未読${status.unread}人`}>
          <div className="readboard__side">
            <span className="readboard__label">既読</span>
            <span className="readboard__num score">{status.read}</span>
          </div>
          <span className="readboard__dash score" aria-hidden="true">
            -
          </span>
          <div className="readboard__side readboard__side--unread">
            <span className="readboard__label">未読</span>
            <span className="readboard__num score">{status.unread}</span>
          </div>
        </div>
        <p className="panel__text">宛先 {status.recipients}人(送信した時点のメンバー)。アプリでお知らせを開いた人を既読にしています。</p>
      </Panel>

      <section className="sheet" aria-labelledby="mail-title">
        <h2 id="mail-title" className="sheet__title">
          メール
        </h2>
        {status.state === 'sending' && <p className="sheet__text">送信中です。送信済み {status.delivered}人、送信待ち {status.pending}人。</p>}
        <dl className="mail-counts">
          <div>
            <dt>送信済み</dt>
            <dd className="score">{status.delivered}</dd>
          </div>
          <div>
            <dt>送信待ち</dt>
            <dd className="score">{status.pending}</dd>
          </div>
          <div className={status.failed > 0 ? 'mail-counts__bad' : undefined}>
            <dt>送信失敗</dt>
            <dd className="score">{status.failed}</dd>
          </div>
          <div>
            <dt>送らなかった</dt>
            <dd className="score">{status.skipped}</dd>
          </div>
        </dl>
        <p className="field__hint">送信済みは、受信側のサーバーが受け取ったことを表します。迷惑メールに振り分けられた場合も含みます。</p>
      </section>

      <section className="sheet" aria-labelledby="remind-title">
        <h2 id="remind-title" className="sheet__title">
          未読の人に再通知
        </h2>
        <p className="sheet__text">
          未読でチームにいる {unreadMembers}人に、件名に【再通知】を付けたメールを送ります。既読の人には送りません。1時間に1回、3回まで(あと
          {reminders.max - reminders.sent}回)。
        </p>
        {message !== null && <Alert tone={message.tone}>{message.text}</Alert>}
        {!reminders.available && (
          <p className="field__hint" id="remind-reason">
            {reminders.reason === 'max'
              ? '再通知は3回行いました。これ以上はできません。'
              : reminders.reason === 'interval'
                ? `次に再通知できるのは ${formatDateTime(reminders.next_available_at)} からです。`
                : '未読の人がいないため、再通知できません。'}
          </p>
        )}
        <button
          type="button"
          className="button button--accent"
          disabled={!reminders.available || sending}
          aria-describedby={reminders.available ? undefined : 'remind-reason'}
          onClick={() => void remind()}
        >
          {sending ? '送っています' : `未読の${unreadMembers}人に再通知する`}
        </button>
      </section>

      <section className="sheet" aria-labelledby="unread-title">
        <h2 id="unread-title" className="sheet__title">
          未読の人({unread.length}人)
        </h2>
        {unread.length === 0 ? (
          <p className="sheet__text">チームにいる人は全員が読みました。</p>
        ) : (
          <ul className="name-list" aria-labelledby="unread-title">
            {unread.map((m, i) => (
              <li key={i} className="name-list__item">
                {m.display_name ?? '(表示名なし)'}
              </li>
            ))}
          </ul>
        )}
        {formerUnread > 0 && <p className="field__hint">ほかに、チームを抜けた未読の人が{formerUnread}人います。</p>}
      </section>

      <section className="sheet" aria-labelledby="failed-title">
        <h2 id="failed-title" className="sheet__title">
          メールが届かなかった人({failures.length}人)
        </h2>
        {failures.length === 0 ? (
          <p className="sheet__text">いまのところいません。</p>
        ) : (
          <ul className="name-list" aria-labelledby="failed-title">
            {failures.map((m, i) => (
              <li key={i} className="name-list__item name-list__item--stacked">
                <span>{m.display_name ?? '(表示名なし)'}</span>
                <span className="name-list__reason">{deliveryReasonLabel(m.status, m.reason)}</span>
              </li>
            ))}
          </ul>
        )}
        {formerFailures > 0 && <p className="field__hint">ほかに、チームを抜けた人が{formerFailures}人います。</p>}
        <p className="field__hint">お知らせはアプリには届いています。メールアドレスの確認は、本人に声をかけてください。</p>
      </section>
      {back}
    </PageFrame>
  )
}
