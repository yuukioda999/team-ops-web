import type { Grade, Team } from '../../api/client.ts'

/** 学年の表示(003)。CSV と同じ書き方 */
export const GRADE_LABELS: Record<Grade, string> = {
  preschool: '未就学',
  e1: '小1',
  e2: '小2',
  e3: '小3',
  e4: '小4',
  e5: '小5',
  e6: '小6',
  j1: '中1',
  j2: '中2',
  j3: '中3',
}

export const GRADES = Object.keys(GRADE_LABELS) as Grade[]

/** 名簿を開けるか。代表・役員・コーチは全員、保護者は自分の子どもだけ(AC-003-08・09) */
export function canOpenRoster(team: Team): boolean {
  return team.permissions.view_all_players || team.roles.includes('parent')
}

export const MAX_GUARDIANS = 4
