import type { Grade, Notice, Team, TeamRole } from '../../api/client.ts'
import { GRADE_LABELS } from '../players/grades.ts'
import { ROLE_LABELS } from '../teams/sports.ts'

export const dateTimeFormat = new Intl.DateTimeFormat('ja-JP', {
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Tokyo',
})

export function formatDateTime(iso: string | null): string {
  return iso === null ? '' : dateTimeFormat.format(new Date(iso))
}

/** 「全員」「小3・小4の家庭」「コーチ・保護者」のように宛先を表示する */
export function targetLabel(target: Notice['target']): string {
  if (target.type === 'all') return '全員'
  if (target.type === 'grades') return `${target.values.map((v) => GRADE_LABELS[v as Grade] ?? v).join('・')}の家庭とスタッフ`
  return target.values.map((v) => ROLE_LABELS[v as TeamRole] ?? v).join('・')
}

/**
 * datetime-local の値を日本時間として読み、UTC の ISO 8601 にする(ADR-0017)。
 * 端末の時間帯の設定に左右されないよう、時差を +09:00 と決めて付ける
 */
export function localInputToIso(value: string): string {
  return new Date(`${value}:00+09:00`).toISOString()
}

const inputParts = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Asia/Tokyo',
})

/** ISO 8601 を、日本時間の datetime-local の値にする */
export function isoToLocalInput(iso: string): string {
  const part = Object.fromEntries(inputParts.formatToParts(new Date(iso)).map((p) => [p.type, p.value]))
  return `${part.year}-${part.month}-${part.day}T${part.hour}:${part.minute}`
}

/**
 * メールが届かなかった・送らなかった理由を、利用者向けの言葉にする(AC-006-06、ADR-0020)。
 * 理由のコードは API(notify-relay の error_code と、送らなかった理由)から来る。
 */
export function deliveryReasonLabel(status: 'failed' | 'skipped', reason: string | null): string {
  switch (reason) {
    case 'invalid_address':
      return 'メールアドレスが存在しない可能性があります'
    case 'provider_rejected':
      return '受信側のサーバーに受け取りを拒否されました'
    case 'provider_unavailable':
    case 'rate_limited':
      return '受信側のサーバーに一時的につながりませんでした'
    case 'expired':
      return '送信の期限を過ぎたため送っていません'
    case 'undeliverable_address':
      return '以前メールが届かなかったアドレスのため送っていません'
    case 'restricted':
      return 'この環境では実在のアドレスに送らないため送っていません'
    default:
      return status === 'failed' ? '送信に失敗しました' : '送っていません'
  }
}

/** 配信状況を見られるか。判定は API で行い、ここでは導線を出すかだけを決める(004 の権限表 ※2) */
export function canViewStatus(team: Team, notice: Notice): boolean {
  return notice.status === 'published' && (team.permissions.manage_all_notices || (notice.mine && team.roles.includes('coach')))
}
