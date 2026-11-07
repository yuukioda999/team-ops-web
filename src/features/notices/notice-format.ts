import type { Grade, Notice, TeamRole } from '../../api/client.ts'
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

/** datetime-local の値(端末の時刻)を、時差付きの ISO 8601 にする */
export function localInputToIso(value: string): string {
  return new Date(value).toISOString()
}

/** ISO 8601 を datetime-local の値(端末の時刻)にする */
export function isoToLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
