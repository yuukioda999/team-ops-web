import { Link } from 'react-router'
import { PageFrame } from '../../components/PageFrame.tsx'
import { Panel } from '../../components/Panel.tsx'
import { useMe } from '../auth/session-context.ts'

/** どのチームにも所属していない人の画面。作成と参加の2つの道を示す(AC-001-14)。 */
export function StartPage() {
  const me = useMe()

  return (
    <PageFrame title="チーム運営" signedInAs={me.email} account>
      <Panel tag="ようこそ" meta={me.display_name ?? undefined} title="チームを用意しましょう">
        <p className="panel__text">まだどのチームにも所属していません。チームを作るか、招待を受けて参加してください。</p>
      </Panel>

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
          招待から参加する
        </h2>
        <p className="sheet__text">
          チームの代表から届いた招待リンクを開くと、そのチームに参加できます。招待リンクはメールやLINEで送られてきます。
        </p>
      </section>
    </PageFrame>
  )
}
