import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { api, errorMessage, fieldErrors, withCsrfRetry, type Member, type Team, type TeamRole } from '../../api/client.ts'
import { Alert } from '../../components/Alert.tsx'
import { PageFrame } from '../../components/PageFrame.tsx'
import { Panel } from '../../components/Panel.tsx'
import { Loading } from '../auth/guards.tsx'
import { useMe, useSession } from '../auth/session-context.ts'
import { TeamPageGate } from '../invitations/TeamPageGate.tsx'
import { ROLE_LABELS, rolesLabel } from '../teams/sports.ts'
import { canRemove, useMembers } from './use-members.ts'

/** 役割の変更で付け外しできる役割。代表は交代でしか動かない(ADR-0015) */
const CHANGEABLE: Exclude<TeamRole, 'representative'>[] = ['officer', 'coach', 'parent']

/** メンバー1人の管理:役割の変更・代表の交代(代表)、除名(代表・役員)。AC-004-03〜09 */
export function MemberPage() {
  const { teamId = '', membershipId = '' } = useParams()
  return (
    <TeamPageGate key={`${teamId}:${membershipId}`} teamId={teamId} allowed={(team) => team.permissions.view_members}>
      {(team) => <MemberDetail team={team} membershipId={Number(membershipId)} />}
    </TeamPageGate>
  )
}

function MemberDetail({ team, membershipId }: { team: Team; membershipId: number }) {
  const me = useMe()
  const { members, failure, reload } = useMembers(team.id)
  const [notice, setNotice] = useState<string | null>(null)
  const member = members?.find((m) => m.membership_id === membershipId)

  if (members !== null && member === undefined) {
    return (
      <PageFrame title={team.name} pageTitle="メンバーが見つかりません" home={`/teams/${team.id}`} signedInAs={me.email} account>
        <Panel tag="メンバー" title="メンバーが見つかりません">
          <p className="panel__text">すでに除名されたか、このチームのメンバーではありません。</p>
          <Link to={`/teams/${team.id}/members`} className="button button--on-panel">
            メンバー一覧に戻る
          </Link>
        </Panel>
      </PageFrame>
    )
  }

  const representative = team.roles.includes('representative')
  return (
    <PageFrame title={team.name} pageTitle={member?.display_name ?? 'メンバー'} home={`/teams/${team.id}`} signedInAs={me.email} account>
      <Panel tag="メンバー" meta={member !== undefined ? rolesLabel(member.roles) : undefined} title={member?.display_name ?? 'メンバー'} />
      {notice !== null && <Alert tone="info">{notice}</Alert>}
      {failure !== null && <Alert tone="error">{failure}</Alert>}
      {member === undefined ? (
        failure === null && <Loading />
      ) : (
        <>
          {team.permissions.manage_roles && (
            <RolesForm key={member.roles.join(',')} team={team} member={member} onSaved={(message) => void reload().then(() => setNotice(message))} />
          )}
          {team.permissions.manage_roles && !member.is_me && member.roles.includes('officer') && (
            <TransferForm team={team} member={member} />
          )}
          {team.permissions.manage_roles && !member.is_me && !member.roles.includes('officer') && (
            <section className="sheet" aria-labelledby="transfer-title">
              <h2 id="transfer-title" className="sheet__title">
                代表を交代する
              </h2>
              <p className="sheet__text">代表にできるのは役員のメンバーだけです。交代するときは、先に役員に任命してください。</p>
            </section>
          )}
          {team.permissions.remove_members && canRemove(representative, member) && <RemoveForm team={team} member={member} />}
          {member.is_me && representative && (
            <section className="sheet" aria-labelledby="leave-title">
              <h2 id="leave-title" className="sheet__title">
                あなたは代表です
              </h2>
              <p className="sheet__text">代表は自分を除名できません。チームを離れるときは、先に役員のメンバーに代表を交代してください。</p>
            </section>
          )}
        </>
      )}
      <Link to={`/teams/${team.id}/members`} className="text-link">
        メンバー一覧に戻る
      </Link>
    </PageFrame>
  )
}

function RolesForm({ team, member, onSaved }: { team: Team; member: Member; onSaved: (message: string) => void }) {
  const navigate = useNavigate()
  const isRepresentative = member.roles.includes('representative')
  const [selected, setSelected] = useState<TeamRole[]>(member.roles.filter((r) => r !== 'representative'))
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  // 役割をすべて外すと除名になる(AC-004-09)。代表は代表の役割が残るので当てはまらない
  const becomesRemoval = selected.length === 0 && !isRepresentative

  function toggle(role: TeamRole, checked: boolean) {
    setConfirming(false)
    setSelected((current) => (checked ? CHANGEABLE.filter((r) => r === role || current.includes(r)) : current.filter((r) => r !== role)))
  }

  async function save() {
    setBusy(true)
    const { data, error } = await withCsrfRetry(() =>
      api.PUT('/api/teams/{team}/members/{membership}/roles', {
        params: { path: { team: team.id, membership: member.membership_id } },
        body: { roles: selected as Exclude<TeamRole, 'representative'>[] },
      }),
    )
    setBusy(false)
    if (data !== undefined) onSaved(`役割を「${rolesLabel(data.member.roles)}」にしました。本人にメールで知らせました。`)
    else setFailure(fieldErrors(error).roles?.[0] ?? errorMessage(error))
  }

  async function remove() {
    setBusy(true)
    const result = await removeMember(team, member)
    setBusy(false)
    if (result.status === 'failed') setFailure(result.message)
    else navigate(`/teams/${team.id}/members`, { replace: true, state: { notice: removedNotice(result, member.display_name ?? 'メンバー') } })
  }

  return (
    <section className="sheet" aria-labelledby="roles-title">
      <h2 id="roles-title" className="sheet__title">
        役割
      </h2>
      {isRepresentative && <p className="sheet__text">代表の役割は、代表の交代でだけ変わります。ほかの役割は、あわせて持てます。</p>}
      {failure !== null && <Alert tone="error">{failure}</Alert>}
      <fieldset className="guardian-list">
        <legend className="choices__legend">持っている役割(複数選べます)</legend>
        {CHANGEABLE.map((role) => (
          <label key={role} className="guardian-list__item">
            <input type="checkbox" checked={selected.includes(role)} onChange={(e) => toggle(role, e.target.checked)} />
            {ROLE_LABELS[role]}
          </label>
        ))}
      </fieldset>
      {member.roles.includes('parent') && !selected.includes('parent') && !becomesRemoval && (
        <p className="field__hint">保護者を外すと、このメンバーと選手との紐づけも外れます。</p>
      )}
      {becomesRemoval ? (
        <div className="stack" role="group" aria-labelledby="removal-confirm">
          <p id="removal-confirm" className="sheet__text">
            役割をすべて外すと、除名になります。{member.display_name ?? 'このメンバー'}さんはチームの情報を見られなくなり、選手との紐づけも外れます。
          </p>
          {confirming ? (
            <>
              <button type="button" className="button button--danger" onClick={() => void remove()} disabled={busy}>
                {member.display_name ?? 'このメンバー'}さんを除名する
              </button>
              <button type="button" className="button button--secondary" onClick={() => setConfirming(false)}>
                やめる
              </button>
            </>
          ) : (
            <button type="button" className="button button--secondary" onClick={() => setConfirming(true)}>
              除名する
            </button>
          )}
        </div>
      ) : (
        <button type="button" className="button button--accent" onClick={() => void save()} disabled={busy}>
          役割を保存する
        </button>
      )}
    </section>
  )
}

function TransferForm({ team, member }: { team: Team; member: Member }) {
  const { refresh } = useSession()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function transfer() {
    setBusy(true)
    const { data, error } = await withCsrfRetry(() =>
      api.POST('/api/teams/{team}/representative', { params: { path: { team: team.id } }, body: { membership_id: member.membership_id } }),
    )
    if (data !== undefined) {
      await refresh() // 自分の役割が変わったので、チームの一覧も読み直す
      setBusy(false)
      navigate(`/teams/${team.id}`, { replace: true })
      return
    }
    setBusy(false)
    setFailure(fieldErrors(error).membership_id?.[0] ?? errorMessage(error))
  }

  return (
    <section className="sheet" aria-labelledby="transfer-title">
      <h2 id="transfer-title" className="sheet__title">
        代表を交代する
      </h2>
      <p className="sheet__text">{member.display_name ?? 'このメンバー'}さんが代表になり、あなたは役員になります。お二人にメールで知らせます。</p>
      {failure !== null && <Alert tone="error">{failure}</Alert>}
      {confirming ? (
        <>
          <button type="button" className="button button--accent" onClick={() => void transfer()} disabled={busy}>
            {member.display_name ?? 'このメンバー'}さんに代表を交代する
          </button>
          <button type="button" className="button button--secondary" onClick={() => setConfirming(false)}>
            やめる
          </button>
        </>
      ) : (
        <button type="button" className="button button--secondary" onClick={() => setConfirming(true)}>
          代表を交代する
        </button>
      )}
    </section>
  )
}

type RemoveResult = { status: 'removed' | 'gone' } | { status: 'failed'; message: string }

/** 除名する。404 は、すでにチームにいない(別の人が先に除名したなど) */
async function removeMember(team: Team, member: Member): Promise<RemoveResult> {
  const { response, error } = await withCsrfRetry(() =>
    api.DELETE('/api/teams/{team}/members/{membership}', { params: { path: { team: team.id, membership: member.membership_id } } }),
  )
  if (response.status === 204) return { status: 'removed' }
  if (response.status === 404) return { status: 'gone' }
  return { status: 'failed', message: fieldErrors(error).member?.[0] ?? errorMessage(error) }
}

function removedNotice(result: RemoveResult, name: string): string {
  return result.status === 'gone' ? `${name}さんは、すでにチームにいません。` : `${name}さんを除名しました。`
}

function RemoveForm({ team, member }: { team: Team; member: Member }) {
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const name = member.display_name ?? 'このメンバー'

  async function remove() {
    setBusy(true)
    const result = await removeMember(team, member)
    setBusy(false)
    if (result.status === 'failed') setFailure(result.message)
    else navigate(`/teams/${team.id}/members`, { replace: true, state: { notice: removedNotice(result, name) } })
  }

  return (
    <section className="sheet" aria-labelledby="remove-title">
      <h2 id="remove-title" className="sheet__title">
        除名する
      </h2>
      <p className="sheet__text">除名すると、{name}さんはすぐにチームの情報を見られなくなり、選手との紐づけも外れます。もう一度参加するには、招待リンクから申請してもらいます。</p>
      {failure !== null && <Alert tone="error">{failure}</Alert>}
      {confirming ? (
        <>
          <button type="button" className="button button--danger" onClick={() => void remove()} disabled={busy}>
            {name}さんを除名する
          </button>
          <button type="button" className="button button--secondary" onClick={() => setConfirming(false)}>
            やめる
          </button>
        </>
      ) : (
        <button type="button" className="button button--secondary" onClick={() => setConfirming(true)}>
          除名する
        </button>
      )}
    </section>
  )
}
