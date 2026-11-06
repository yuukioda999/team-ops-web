import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { api, errorMessage, withCsrfRetry, type JoinRequest, type Team } from '../../api/client.ts'
import { Alert } from '../../components/Alert.tsx'
import { PageFrame } from '../../components/PageFrame.tsx'
import { Panel } from '../../components/Panel.tsx'
import { Loading } from '../auth/guards.tsx'
import { useMe } from '../auth/session-context.ts'
import { TeamPageGate } from './TeamPageGate.tsx'

/** 承認待ちの申請の一覧と承認・却下(AC-002-11〜14)。代表・役員だけ。 */
export function JoinRequestsPage() {
  const { teamId = '' } = useParams()
  return (
    <TeamPageGate key={teamId} teamId={teamId} allowed={(team) => team.permissions.review_join_requests}>
      {(team) => <JoinRequestList team={team} />}
    </TeamPageGate>
  )
}

const dateFormat = new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })

/** Roles that can be given on approval. Officer and representative are set in 004 (AC-002-14). */
const GRANTABLE = [
  { value: 'parent', label: '保護者' },
  { value: 'coach', label: 'コーチ' },
] as const
type Grantable = (typeof GRANTABLE)[number]['value']

function JoinRequestList({ team }: { team: Team }) {
  const me = useMe()
  const [requests, setRequests] = useState<JoinRequest[] | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void api.GET('/api/teams/{team}/join-requests', { params: { path: { team: team.id } } }).then(({ data, error }) => {
      if (!active) return
      if (data !== undefined) setRequests(data.join_requests)
      else setFailure(errorMessage(error))
    })
    return () => {
      active = false
    }
  }, [team.id])

  function done(request: JoinRequest, message: string) {
    setRequests((list) => list?.filter((r) => r.id !== request.id) ?? null)
    setNotice(message)
  }

  return (
    <PageFrame title={team.name} pageTitle="参加申請" home={`/teams/${team.id}`} signedInAs={me.email} account>
      <Panel tag="参加申請" meta={team.name} title="承認待ちの申請">
        <p className="panel__text">役割を選んで承認すると、メンバーになります。却下しても、申請した人には通知されません。</p>
      </Panel>
      {notice !== null && <Alert tone="info">{notice}</Alert>}
      {failure !== null && <Alert tone="error">{failure}</Alert>}
      {requests === null && failure === null && <Loading />}
      {requests?.length === 0 && (
        <section className="sheet" aria-labelledby="empty">
          <h2 id="empty" className="sheet__title">
            承認待ちの申請はありません
          </h2>
          <p className="sheet__text">招待リンクを共有すると、ここに申請が届きます。</p>
          <Link to={`/teams/${team.id}/invitation`} className="button button--accent">
            メンバーを招待する
          </Link>
        </section>
      )}
      {requests?.map((request) => (
        <RequestCard key={request.id} team={team} request={request} onDone={done} onError={setFailure} />
      ))}
    </PageFrame>
  )
}

function RequestCard({
  team,
  request,
  onDone,
  onError,
}: {
  team: Team
  request: JoinRequest
  onDone: (request: JoinRequest, message: string) => void
  onError: (message: string) => void
}) {
  const [roles, setRoles] = useState<Grantable[]>(['parent'])
  const [roleError, setRoleError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const name = request.display_name ?? '(表示名なし)'

  function toggle(role: Grantable, checked: boolean) {
    setRoles((current) => (checked ? [...current, role] : current.filter((r) => r !== role)))
  }

  async function approve() {
    if (roles.length === 0) {
      setRoleError('役割を1つ以上選んでください')
      return
    }
    setBusy(true)
    setRoleError(undefined)
    const { response, error } = await withCsrfRetry(() =>
      api.POST('/api/teams/{team}/join-requests/{joinRequest}/approve', {
        params: { path: { team: team.id, joinRequest: request.id } },
        body: { roles },
      }),
    )
    setBusy(false)
    if (response.status === 204) onDone(request, `${name}さんを承認しました。`)
    else if (response.status === 404) onDone(request, `${name}さんの申請は、すでに処理されています。`)
    else onError(errorMessage(error))
  }

  async function reject() {
    setBusy(true)
    const { response, error } = await withCsrfRetry(() =>
      api.POST('/api/teams/{team}/join-requests/{joinRequest}/reject', { params: { path: { team: team.id, joinRequest: request.id } } }),
    )
    setBusy(false)
    if (response.status === 204) onDone(request, `${name}さんの申請を却下しました。`)
    else if (response.status === 404) onDone(request, `${name}さんの申請は、すでに処理されています。`)
    else onError(errorMessage(error))
  }

  const titleId = `request-${request.id}`
  return (
    <section className="sheet" aria-labelledby={titleId}>
      <h2 id={titleId} className="sheet__title">
        {name}
      </h2>
      <p className="sheet__text">{request.message ?? 'ひとことはありません'}</p>
      <p className="sheet__text">申請日時:{dateFormat.format(new Date(request.created_at))}</p>
      <fieldset className="choices choices--two" aria-describedby={roleError !== undefined ? `${titleId}-error` : undefined}>
        <legend className="choices__legend">承認する役割(複数選べます)</legend>
        {GRANTABLE.map(({ value, label }) => (
          <label key={value} className="choice">
            <input type="checkbox" checked={roles.includes(value)} onChange={(e) => toggle(value, e.target.checked)} />
            {label}
          </label>
        ))}
      </fieldset>
      {roleError !== undefined && (
        <p id={`${titleId}-error`} className="field__error">
          {roleError}
        </p>
      )}
      <button type="button" className="button button--accent" onClick={() => void approve()} disabled={busy} aria-describedby={titleId}>
        承認する
      </button>
      <button type="button" className="button button--secondary" onClick={() => void reject()} disabled={busy} aria-describedby={titleId}>
        却下する
      </button>
    </section>
  )
}
