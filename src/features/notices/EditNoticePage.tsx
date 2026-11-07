import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { api, errorMessage, fieldErrors, withCsrfRetry, type Notice, type Team } from '../../api/client.ts'
import { Alert } from '../../components/Alert.tsx'
import { PageFrame } from '../../components/PageFrame.tsx'
import { Panel } from '../../components/Panel.tsx'
import { Loading } from '../auth/guards.tsx'
import { useMe } from '../auth/session-context.ts'
import { TeamPageGate } from '../invitations/TeamPageGate.tsx'
import { isoToLocalInput, localInputToIso } from './notice-format.ts'
import { NoticeForm, type NoticeValues } from './NoticeForm.tsx'

/** 予約中のお知らせの編集。作成者と代表・役員(AC-005-10)。送信済みは編集できない(AC-005-06) */
export function EditNoticePage() {
  const { teamId = '', noticeId = '' } = useParams()
  return (
    <TeamPageGate key={`${teamId}:${noticeId}`} teamId={teamId} allowed={(team) => team.permissions.create_notices} deniedText="予約中のお知らせは、代表・役員・コーチが編集できます。">
      {(team) => <EditNotice team={team} noticeId={Number(noticeId)} />}
    </TeamPageGate>
  )
}

function EditNotice({ team, noticeId }: { team: Team; noticeId: number }) {
  const me = useMe()
  const navigate = useNavigate()
  const [notice, setNotice] = useState<Notice | null>(null)
  const [missing, setMissing] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    void api.GET('/api/teams/{team}/notices/scheduled', { params: { path: { team: team.id } } }).then(({ data, error }) => {
      if (!active) return
      if (data === undefined) setFailure(errorMessage(error))
      else {
        const found = data.notices.find((n) => n.id === noticeId)
        if (found === undefined) setMissing(true)
        else setNotice(found)
      }
    })
    return () => {
      active = false
    }
  }, [team.id, noticeId])

  async function save(values: NoticeValues) {
    setBusy(true)
    setErrors({})
    setFailure(null)
    const { data, error, response } = await withCsrfRetry(() =>
      api.PATCH('/api/teams/{team}/notices/{notice}', {
        params: { path: { team: team.id, notice: noticeId } },
        body: { title: values.title, body: values.body, target: values.target, scheduled_at: localInputToIso(values.scheduledAt) },
      }),
    )
    setBusy(false)
    if (data !== undefined) {
      navigate(`/teams/${team.id}/notices/scheduled`, { replace: true, state: { notice: `「${data.notice.title}」の予約を保存しました。` } })
      return
    }
    const fields = fieldErrors(error)
    if (response.status === 422) setErrors(fields)
    else setFailure(fields.notice?.[0] ?? errorMessage(error))
  }

  if (missing) {
    return (
      <PageFrame title={team.name} pageTitle="予約中のお知らせが見つかりません" home={`/teams/${team.id}`} signedInAs={me.email} account>
        <Panel tag="お知らせ" title="予約中のお知らせが見つかりません">
          <p className="panel__text">すでに送信されたか、取り消されたか、あなたが編集できないお知らせです。送信済みのお知らせは編集できないので、訂正は新しいお知らせで送ってください。</p>
          <Link to={`/teams/${team.id}/notices/scheduled`} className="button button--on-panel">
            予約中のお知らせに戻る
          </Link>
        </Panel>
      </PageFrame>
    )
  }

  return (
    <PageFrame title={team.name} pageTitle="予約を編集" home={`/teams/${team.id}`} signedInAs={me.email} account>
      <Panel tag="お知らせ" title="予約を編集" />
      {failure !== null && <Alert tone="error">{failure}</Alert>}
      {notice === null ? (
        failure === null && <Loading />
      ) : (
        <NoticeForm
          team={team}
          mode="edit"
          busy={busy}
          errors={errors}
          initial={{ title: notice.title, body: notice.body, target: notice.target, scheduled: true, scheduledAt: notice.scheduled_at === null ? '' : isoToLocalInput(notice.scheduled_at) }}
          onSubmit={(v) => void save(v)}
        />
      )}
      <Link to={`/teams/${team.id}/notices/scheduled`} className="text-link">
        予約中のお知らせに戻る
      </Link>
    </PageFrame>
  )
}
