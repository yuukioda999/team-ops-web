import { Link, useLocation, useParams } from 'react-router'
import type { Team } from '../../api/client.ts'
import { Alert } from '../../components/Alert.tsx'
import { PageFrame } from '../../components/PageFrame.tsx'
import { Panel } from '../../components/Panel.tsx'
import { Loading } from '../auth/guards.tsx'
import { useMe } from '../auth/session-context.ts'
import { TeamPageGate } from '../invitations/TeamPageGate.tsx'
import { rolesLabel } from '../teams/sports.ts'
import { useMembers } from './use-members.ts'

/** メンバー一覧(表示名と役割)。代表・役員だけ(ADR-0015) */
export function MembersPage() {
  const { teamId = '' } = useParams()
  return (
    <TeamPageGate key={teamId} teamId={teamId} allowed={(team) => team.permissions.view_members}>
      {(team) => <Members team={team} />}
    </TeamPageGate>
  )
}

function Members({ team }: { team: Team }) {
  const me = useMe()
  const notice = (useLocation().state as { notice?: string } | null)?.notice
  const { members, failure } = useMembers(team.id)
  const manage = team.permissions.manage_roles

  return (
    <PageFrame title={team.name} pageTitle="メンバー" home={`/teams/${team.id}`} signedInAs={me.email} account>
      <Panel tag="メンバー" meta={members !== null ? `${members.length}人` : undefined} title="メンバー">
        <p className="panel__text">
          {manage ? 'メンバーを選ぶと、役割の変更・代表の交代・除名ができます。' : 'メンバーを選ぶと、除名ができます。代表と役員は除名できません。'}
        </p>
      </Panel>
      {notice !== undefined && <Alert tone="info">{notice}</Alert>}
      {failure !== null && <Alert tone="error">{failure}</Alert>}
      {members === null && failure === null && <Loading />}
      {members !== null && (
        <ul className="member-list" aria-label="メンバー">
          {members.map((member) => (
            <li key={member.membership_id} className="member-list__item">
              <Link to={`/teams/${team.id}/members/${member.membership_id}`} className="member-list__link">
                <span className="member-list__name">
                  {member.display_name ?? '(表示名なし)'}
                  {member.is_me && <span className="member-list__me">あなた</span>}
                </span>
                <span className="member-list__roles">{rolesLabel(member.roles)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {team.permissions.manage_invitation && (
        <Link to={`/teams/${team.id}/invitation`} className="button button--secondary">
          メンバーを招待する
        </Link>
      )}
    </PageFrame>
  )
}
