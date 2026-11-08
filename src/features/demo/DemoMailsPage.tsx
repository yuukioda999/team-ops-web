import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { api, errorMessage, type DemoMail, type Team } from '../../api/client.ts'
import { Alert } from '../../components/Alert.tsx'
import { PageFrame } from '../../components/PageFrame.tsx'
import { Panel } from '../../components/Panel.tsx'
import { Loading } from '../auth/guards.tsx'
import { useMe } from '../auth/session-context.ts'
import { TeamPageGate } from '../invitations/TeamPageGate.tsx'
import { formatDateTime } from '../notices/notice-format.ts'

/**
 * デモチームから送られたメール(AC-007-12)。メールの受け止め先(Mailpit)に届いたものを、新しい順に出す。
 * 他の訪問者のメールは API が返さない。
 */
export function DemoMailsPage() {
  const { teamId = '' } = useParams()
  return (
    <TeamPageGate key={teamId} teamId={teamId} allowed={() => true}>
      {(team) => <DemoMails team={team} />}
    </TeamPageGate>
  )
}

function DemoMails({ team }: { team: Team }) {
  const me = useMe()
  const [mails, setMails] = useState<DemoMail[] | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    void api
      .GET('/api/teams/{team}/demo/mails', { params: { path: { team: team.id } } })
      .then(({ data, error, response }) => {
        if (!active) return
        if (data !== undefined) setMails(data.mails)
        else setFailure(response.status === 404 ? 'このチームはデモチームではないため、送信されたメールはありません。' : errorMessage(error))
      })
      .catch(() => {
        if (active) setFailure(errorMessage(null))
      })
    return () => {
      active = false
    }
  }, [team.id, reload])

  return (
    <PageFrame title={team.name} pageTitle="送信されたメール" home={`/teams/${team.id}`} signedInAs={me.email} account>
      <Panel tag="デモ" meta={mails !== null ? `${mails.length}通` : undefined} title="送信されたメール">
        <p className="panel__text">
          このデモチームから送ったメールです。実際には外部に送らず、デモ用の受け止め先に届いたものを表示しています。新しい順に30通まで。
        </p>
      </Panel>
      {failure !== null && <Alert tone="error">{failure}</Alert>}
      {mails === null && failure === null && <Loading />}
      {mails !== null && mails.length === 0 && (
        <section className="sheet">
          <p className="sheet__text">まだメールはありません。お知らせを送ると、ここに届いたメールが表示されます。</p>
          <Link to={`/teams/${team.id}/notices/new`} className="button button--accent">
            お知らせを書く
          </Link>
        </section>
      )}
      {mails !== null && mails.length > 0 && (
        <ul className="mail-list" aria-label="送信されたメール">
          {mails.map((m, i) => (
            <li key={i} className="mail">
              <h2 className="mail__subject">{m.subject}</h2>
              <p className="mail__meta">
                <time dateTime={m.sent_at}>{formatDateTime(m.sent_at)}</time> 宛先 {m.to.length}人:{m.to.join('、')}
              </p>
              <pre className="mail__body">{m.text}</pre>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="button button--secondary" onClick={() => setReload((n) => n + 1)}>
        新しいメールを確かめる
      </button>
    </PageFrame>
  )
}
