import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { api, errorMessage, type AuditLogEntry, type Team } from '../../api/client.ts'
import { Alert } from '../../components/Alert.tsx'
import { PageFrame } from '../../components/PageFrame.tsx'
import { Panel } from '../../components/Panel.tsx'
import { Loading } from '../auth/guards.tsx'
import { useMe } from '../auth/session-context.ts'
import { TeamPageGate } from '../invitations/TeamPageGate.tsx'

/** 監査ログ。代表だけ。新しい順に100件ずつ(AC-004-12) */
export function AuditLogPage() {
  const { teamId = '' } = useParams()
  return (
    <TeamPageGate key={teamId} teamId={teamId} allowed={(team) => team.permissions.view_audit_logs} deniedText="監査ログは、チームの代表だけが見られます。">
      {(team) => <AuditLog team={team} />}
    </TeamPageGate>
  )
}

const timeFormat = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })

function actorName(log: AuditLogEntry): string {
  if (log.actor === 'system') return '(自動)'
  if (log.actor === 'former') return '(退会したメンバー)'
  return log.actor_display_name ?? '(表示名なし)'
}

function AuditLog({ team }: { team: Team }) {
  const me = useMe()
  const [logs, setLogs] = useState<AuditLogEntry[] | null>(null)
  const [next, setNext] = useState<number | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    void api.GET('/api/teams/{team}/audit-logs', { params: { path: { team: team.id } } }).then(({ data, error }) => {
      if (!active) return
      if (data !== undefined) {
        setLogs(data.logs)
        setNext(data.next_before)
      } else setFailure(errorMessage(error))
    })
    return () => {
      active = false
    }
  }, [team.id])

  async function loadOlder(before: number) {
    setBusy(true)
    const { data, error } = await api.GET('/api/teams/{team}/audit-logs', { params: { path: { team: team.id }, query: { before } } })
    setBusy(false)
    if (data !== undefined) {
      setLogs((current) => [...(current ?? []), ...data.logs])
      setNext(data.next_before)
      setFailure(null)
    } else setFailure(errorMessage(error))
  }

  return (
    <PageFrame title={team.name} pageTitle="監査ログ" home={`/teams/${team.id}`} signedInAs={me.email} account>
      <Panel tag="監査ログ" title="監査ログ">
        <p className="panel__text">誰が・いつ・何をしたかの記録です。名簿の閲覧や役割の変更なども残ります。新しい順に表示します。</p>
      </Panel>
      {failure !== null && <Alert tone="error">{failure}</Alert>}
      {logs === null && failure === null && <Loading />}
      {logs?.length === 0 && (
        <section className="sheet" aria-labelledby="empty">
          <h2 id="empty" className="sheet__title">
            まだ記録はありません
          </h2>
        </section>
      )}
      {logs !== null && logs.length > 0 && (
        <ol className="audit-list" aria-label="記録">
          {logs.map((log) => (
            <li key={log.id} className="audit-list__item">
              <span className="audit-list__action">{log.action_label}</span>
              <span className="audit-list__meta">
                <time dateTime={log.created_at}>{timeFormat.format(new Date(log.created_at))}</time>
                {' / '}
                {actorName(log)}
              </span>
            </li>
          ))}
        </ol>
      )}
      {next !== null && (
        <button type="button" className="button button--secondary" onClick={() => void loadOlder(next)} disabled={busy}>
          {busy ? '読み込んでいます' : 'さらに古い記録を見る'}
        </button>
      )}
      <Link to={`/teams/${team.id}`} className="text-link">
        チームのホームに戻る
      </Link>
    </PageFrame>
  )
}
