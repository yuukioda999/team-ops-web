import type { Sport, Team } from '../../api/client.ts'

export const SPORT_LABELS: Record<Sport, string> = {
  soccer: 'サッカー',
  baseball: '野球',
  other: 'その他',
}

export const ROLE_LABELS: Record<Team['role'], string> = {
  representative: '代表',
}
