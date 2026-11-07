import type { Sport, TeamRole } from '../../api/client.ts'

export const SPORT_LABELS: Record<Sport, string> = {
  soccer: 'サッカー',
  baseball: '野球',
  other: 'その他',
}

export const SPORTS: Sport[] = ['soccer', 'baseball', 'other']

export const ROLE_LABELS: Record<TeamRole, string> = {
  representative: '代表',
  officer: '役員',
  coach: 'コーチ',
  parent: '保護者',
}

/** 「コーチ・保護者」のように、持っている役割をまとめて表示する(1人が複数持てる、ADR-0011) */
export function rolesLabel(roles: TeamRole[]): string {
  return roles.map((role) => ROLE_LABELS[role]).join('・')
}
