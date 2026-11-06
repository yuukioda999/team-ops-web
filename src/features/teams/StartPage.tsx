import { Link } from 'react-router'
import type { MyJoinRequest } from '../../api/client.ts'
import { PageFrame } from '../../components/PageFrame.tsx'
import { Panel } from '../../components/Panel.tsx'
import { useMe } from '../auth/session-context.ts'

/** 自分の参加申請の状態(AC-002-09・13・15) */
const REQUEST_STATUS: Record<MyJoinRequest['status'], (team: string) => string> = {
  pending: (team) => `「${team}」に参加を申請しています。承認されると、メールでお知らせします。`,
  rejected: (team) => `「${team}」への参加は承認されませんでした。`,
  cancelled: (team) => `「${team}」への申請は、14日間承認されなかったため取り消されました。`,
  approved: (team) => `「${team}」への参加が承認されました。`,
}

/** どのチームにも所属していない人の画面。作成と参加の2つの道を示す(AC-001-14)。 */
export function StartPage() {
  const me = useMe()

  return (
    <PageFrame title="チーム運営" pageTitle="チームを用意しましょう" signedInAs={me.email} account>
      <Panel tag="ようこそ" meta={me.display_name ?? undefined} title="チームを用意しましょう">
        <p className="panel__text">まだどのチームにも所属していません。チームを作るか、招待を受けて参加してください。</p>
      </Panel>

      {me.join_requests.length > 0 && (
        <section className="sheet" aria-labelledby="requests-title">
          <h2 id="requests-title" className="sheet__title">
            参加申請
          </h2>
          <ul className="request-list">
            {me.join_requests.map((request) => (
              <li key={request.id} className="sheet__text">
                {REQUEST_STATUS[request.status](request.team_name)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="sheet" aria-labelledby="create-title">
        <h2 id="create-title" className="sheet__title">
          チームを作成する
        </h2>
        <p className="sheet__text">代表として新しいチームを作ります。作ったあとで、コーチや保護者を招待できます。</p>
        <Link to="/teams/new" className="button button--accent">
          チームを作成する
        </Link>
      </section>

      <section className="sheet" aria-labelledby="join-title">
        <h2 id="join-title" className="sheet__title">
          招待リンクから参加する
        </h2>
        <p className="sheet__text">
          チームの代表から届いた招待リンクを開くと、そのチームに参加できます。招待リンクはメールやLINEで送られてきます。
        </p>
      </section>
    </PageFrame>
  )
}
