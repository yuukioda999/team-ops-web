import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { api, errorMessage, withCsrfRetry, type Invitation, type Team } from '../../api/client.ts'
import { Alert } from '../../components/Alert.tsx'
import { PageFrame } from '../../components/PageFrame.tsx'
import { Panel } from '../../components/Panel.tsx'
import { Loading } from '../auth/guards.tsx'
import { useMe } from '../auth/session-context.ts'
import { TeamPageGate } from './TeamPageGate.tsx'

/** メンバーを招待する画面(AC-002-01〜03)。代表・役員だけ。 */
export function InvitationPage() {
  const { teamId = '' } = useParams()
  return (
    <TeamPageGate key={teamId} teamId={teamId} allowed={(team) => team.permissions.manage_invitation}>
      {(team) => <InvitationManager team={team} />}
    </TeamPageGate>
  )
}

const dateFormat = new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })

function InvitationManager({ team }: { team: Team }) {
  const me = useMe()
  const [invitation, setInvitation] = useState<Invitation | null | undefined>(undefined)
  const [drawn, setDrawn] = useState<{ url: string; src: string } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    void api.GET('/api/teams/{team}/invitation', { params: { path: { team: team.id } } }).then(({ data, error }) => {
      if (!active) return
      if (data !== undefined) setInvitation(data.invitation)
      else setFailure(errorMessage(error))
    })
    return () => {
      active = false
    }
  }, [team.id])

  // The QR code is drawn here from the URL; the token is never sent anywhere else (ADR-0010)
  const url = invitation?.url ?? null
  useEffect(() => {
    if (url === null) return
    let active = true
    void QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }).then((svg) => {
      if (active) setDrawn({ url, src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` })
    })
    return () => {
      active = false
    }
  }, [url])
  // Only the QR code of the link shown now (an old one disappears as soon as the link changes)
  const qr = drawn !== null && drawn.url === url ? drawn.src : null

  async function issue() {
    setBusy(true)
    setNotice(null)
    setFailure(null)
    const replacing = invitation !== null && invitation !== undefined
    const { data, error } = await withCsrfRetry(() => api.POST('/api/teams/{team}/invitation', { params: { path: { team: team.id } } }))
    setBusy(false)
    if (data !== undefined) {
      setInvitation(data.invitation)
      setNotice(replacing ? '新しいリンクを発行しました。前のリンクは使えなくなりました。' : '招待リンクを発行しました。')
    } else {
      setFailure(errorMessage(error))
    }
  }

  async function revoke() {
    setBusy(true)
    setNotice(null)
    setFailure(null)
    const { response, error } = await withCsrfRetry(() => api.DELETE('/api/teams/{team}/invitation', { params: { path: { team: team.id } } }))
    setBusy(false)
    if (response.status === 204) {
      setInvitation(null)
      setNotice('招待リンクを無効にしました。このリンクからは参加を申請できません。')
    } else {
      setFailure(errorMessage(error))
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setNotice('リンクをコピーしました。LINE などに貼り付けてください。')
    } catch {
      setNotice('コピーできませんでした。リンクを長押しして選んでください。')
    }
  }

  return (
    <PageFrame title={team.name} pageTitle="メンバーを招待" home={`/teams/${team.id}`} signedInAs={me.email} account>
      <Panel tag="招待" meta={team.name} title="メンバーを招待">
        <p className="panel__text">このリンクを LINE などで共有してください。リンクから申請した人を、承認するとメンバーになります。</p>
      </Panel>
      {notice !== null && <Alert tone="info">{notice}</Alert>}
      {failure !== null && <Alert tone="error">{failure}</Alert>}

      {invitation === undefined ? (
        <Loading />
      ) : invitation === null ? (
        <section className="sheet" aria-labelledby="no-link">
          <h2 id="no-link" className="sheet__title">
            有効な招待リンクはありません
          </h2>
          <p className="sheet__text">リンクの有効期限は発行から7日です。</p>
          <button type="button" className="button button--accent" onClick={() => void issue()} disabled={busy}>
            {busy ? '発行しています' : '招待リンクを発行する'}
          </button>
        </section>
      ) : (
        <section className="sheet" aria-labelledby="link-title">
          <h2 id="link-title" className="sheet__title">
            招待リンク
          </h2>
          <p className="sheet__text">有効期限:{dateFormat.format(new Date(invitation.expires_at))}まで</p>
          <p className="invite__url">{invitation.url}</p>
          <button type="button" className="button button--accent" onClick={() => void copy(invitation.url)}>
            リンクをコピーする
          </button>
          {qr !== null && <img className="invite__qr" src={qr} alt="招待リンクのQRコード" width={200} height={200} />}
          <button type="button" className="button button--secondary" onClick={() => void issue()} disabled={busy}>
            新しいリンクを発行する(今のリンクは使えなくなります)
          </button>
          <button type="button" className="button button--secondary" onClick={() => void revoke()} disabled={busy}>
            リンクを無効にする
          </button>
        </section>
      )}

      <Link to={`/teams/${team.id}/join-requests`} className="text-link">
        承認待ちの申請を見る
      </Link>
    </PageFrame>
  )
}
