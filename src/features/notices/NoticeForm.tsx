import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api, errorMessage, withCsrfRetry, type Grade, type NoticeTargetInput, type Team, type TeamRole } from '../../api/client.ts'
import { TextField } from '../../components/TextField.tsx'
import { useFocusFirstInvalid } from '../../components/use-focus-first-invalid.ts'
import { GRADE_LABELS, GRADES } from '../players/grades.ts'
import { ROLE_LABELS } from '../teams/sports.ts'

const ROLES: TeamRole[] = ['representative', 'officer', 'coach', 'parent']

type Count = { status: 'counting' } | { status: 'done'; count: number } | { status: 'failed'; message: string }

async function countRecipients(teamId: string, target: NoticeTargetInput, noticeId: number | undefined): Promise<Count> {
  try {
    const { data, error } = await withCsrfRetry(() =>
      api.POST('/api/teams/{team}/notices/recipient-count', { params: { path: { team: teamId } }, body: noticeId === undefined ? { target } : { target, notice_id: noticeId } }),
    )
    return data !== undefined ? { status: 'done', count: data.count } : { status: 'failed', message: errorMessage(error) }
  } catch {
    return { status: 'failed', message: errorMessage(null) }
  }
}

export type NoticeValues = {
  title: string
  body: string
  target: NoticeTargetInput
  /** 予約するか(false なら今すぐ送信) */
  scheduled: boolean
  /** datetime-local の値 */
  scheduledAt: string
}

/**
 * お知らせの作成・予約の編集のフォーム(AC-005-01・02・09・13)。
 * 宛先を変えるたびに届く人数を API に聞き、0人なら送れない。数えられなかったら、送る前にもう一度数えてもらう。
 * 予約の編集では、作成者を送信者として数える(公開のときと同じ)。
 */
export function NoticeForm({
  team,
  initial,
  noticeId,
  mode,
  busy,
  errors,
  onSubmit,
}: {
  team: Team
  initial: NoticeValues
  /** 編集する予約のID(edit のとき) */
  noticeId?: number
  /** new:今すぐ送信か予約を選べる。edit:予約の編集 */
  mode: 'new' | 'edit'
  busy: boolean
  errors: Record<string, string[]>
  onSubmit: (values: NoticeValues) => void
}) {
  const [values, setValues] = useState<NoticeValues>(initial)
  const [schedule, setSchedule] = useState(mode === 'edit' || initial.scheduled)
  const [count, setCount] = useState<Count>({ status: 'counting' })
  /** もう一度数えるたびに増やす */
  const [attempt, setAttempt] = useState(0)
  const form = useRef<HTMLFormElement>(null)
  useFocusFirstInvalid(form, errors)

  const targetKey = JSON.stringify(values.target)
  // 学年・役割を1つも選んでいなければ、聞くまでもなく0人
  const nothingChosen = values.target.type !== 'all' && values.target.values.length === 0
  useEffect(() => {
    // 宛先を続けて変えたとき、前の問い合わせの答えで上書きしない
    const controller = new AbortController()
    if (!nothingChosen) {
      void countRecipients(team.id, JSON.parse(targetKey) as NoticeTargetInput, noticeId).then((result) => {
        if (!controller.signal.aborted) setCount(result)
      })
    }
    return () => controller.abort()
  }, [team.id, targetKey, nothingChosen, noticeId, attempt])
  const shown: Count = nothingChosen ? { status: 'done', count: 0 } : count
  const shownCount = shown.status === 'done' ? shown.count : null

  // 宛先を変えたら、前の宛先の人数は出さない(数え直すまで送れない)
  function setTarget(target: NoticeTargetInput) {
    setValues({ ...values, target })
    setCount({ status: 'counting' })
  }

  function setType(type: NoticeTargetInput['type']) {
    setTarget({ type, values: [] })
  }

  function toggleValue(value: string, checked: boolean) {
    const current = values.target.values
    setTarget({ ...values.target, values: checked ? [...current, value] : current.filter((v) => v !== value) })
  }

  function recount() {
    setCount({ status: 'counting' })
    setAttempt(attempt + 1)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    onSubmit({ ...values, scheduled: schedule })
  }

  const choices: { value: string; label: string }[] =
    values.target.type === 'grades'
      ? GRADES.map((g: Grade) => ({ value: g, label: GRADE_LABELS[g] }))
      : values.target.type === 'roles'
        ? ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))
        : []
  const targetError = errors['target.values']?.[0] ?? errors.target?.[0]
  const noRecipients = shownCount === 0
  const action = schedule ? '予約する' : shownCount !== null && shownCount > 0 ? `${shownCount}人に送信する` : '送信する'

  return (
    <form ref={form} className="sheet" onSubmit={submit} noValidate aria-label="お知らせ">
      <TextField
        label="タイトル"
        name="title"
        required
        maxLength={100}
        value={values.title}
        onChange={(e) => setValues({ ...values, title: e.target.value })}
        hint="100文字まで。メールの件名にもなります"
        error={errors.title?.[0]}
      />
      <div className="field">
        <label className="field__label" htmlFor="notice-body">
          本文
        </label>
        <textarea
          id="notice-body"
          name="body"
          className="field__input field__textarea"
          required
          maxLength={2000}
          rows={8}
          value={values.body}
          aria-invalid={errors.body !== undefined ? true : undefined}
          aria-describedby={errors.body !== undefined ? 'notice-body-error' : 'notice-body-hint'}
          onChange={(e) => setValues({ ...values, body: e.target.value })}
        />
        <p id="notice-body-hint" className="field__hint">
          2,000文字まで({values.body.length}文字)。URL はリンクになります
        </p>
        {errors.body !== undefined && (
          <p id="notice-body-error" className="field__error">
            {errors.body[0]}
          </p>
        )}
      </div>
      <fieldset className="choices">
        <legend className="choices__legend">宛先</legend>
        {(
          [
            ['all', '全員'],
            ['grades', '学年で選ぶ'],
            ['roles', '役割で選ぶ'],
          ] as const
        ).map(([type, label]) => (
          <label key={type} className="choice">
            <input type="radio" name="target-type" value={type} checked={values.target.type === type} onChange={() => setType(type)} />
            {label}
          </label>
        ))}
      </fieldset>
      {choices.length > 0 && (
        <fieldset className="guardian-list target-values" aria-describedby={targetError !== undefined ? 'target-error' : 'target-hint'}>
          <legend className="choices__legend">{values.target.type === 'grades' ? '学年(複数選べます)' : '役割(複数選べます)'}</legend>
          {choices.map((c) => (
            <label key={c.value} className="guardian-list__item">
              <input type="checkbox" checked={values.target.values.includes(c.value)} onChange={(e) => toggleValue(c.value, e.target.checked)} />
              {c.label}
            </label>
          ))}
          <p id="target-hint" className="field__hint">
            {values.target.type === 'grades' ? '選んだ学年の選手の保護者と、代表・役員・コーチ全員に届きます。' : '選んだ役割を持つメンバーに届きます。'}
          </p>
        </fieldset>
      )}
      {targetError !== undefined && (
        <p id="target-error" className="field__error">
          {targetError}
        </p>
      )}
      <p className="recipient-count" role="status">
        {shown.status === 'counting'
          ? '届く人数を数えています'
          : shown.status === 'failed'
            ? `届く人数を数えられませんでした。${shown.message}`
            : noRecipients
              ? '届く人がいません。宛先を選んでください。'
              : `${shown.count}人に届きます(${mode === 'edit' ? '作成者' : 'あなた'}を含む。同じ人には1通だけ)`}
      </p>
      {shown.status === 'failed' && (
        <button type="button" className="button button--secondary" onClick={recount}>
          もう一度数える
        </button>
      )}
      {mode === 'new' && (
        <fieldset className="choices">
          <legend className="choices__legend">送るとき</legend>
          <label className="choice">
            <input type="radio" name="when" checked={!schedule} onChange={() => setSchedule(false)} />
            今すぐ送る
          </label>
          <label className="choice">
            <input type="radio" name="when" checked={schedule} onChange={() => setSchedule(true)} />
            予約して送る
          </label>
        </fieldset>
      )}
      {schedule && (
        <div className="field">
          <label className="field__label" htmlFor="notice-scheduled-at">
            予約日時
          </label>
          <input
            id="notice-scheduled-at"
            type="datetime-local"
            className="field__input"
            required
            value={values.scheduledAt}
            aria-invalid={errors.scheduled_at !== undefined ? true : undefined}
            aria-describedby={errors.scheduled_at !== undefined ? 'scheduled-at-error' : 'scheduled-at-hint'}
            onChange={(e) => setValues({ ...values, scheduledAt: e.target.value })}
          />
          <p id="scheduled-at-hint" className="field__hint">
            日本時間で、5分後から30日後まで。指定した日時まで、宛先の人には表示されません
          </p>
          {errors.scheduled_at !== undefined && (
            <p id="scheduled-at-error" className="field__error">
              {errors.scheduled_at[0]}
            </p>
          )}
        </div>
      )}
      <button type="submit" className="button button--accent" disabled={busy || noRecipients || shownCount === null}>
        {busy ? '送っています' : mode === 'edit' ? '予約を保存する' : action}
      </button>
    </form>
  )
}
