import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { api, errorMessage, fieldErrors, withCsrfRetry, type Team } from '../../api/client.ts'
import { Alert } from '../../components/Alert.tsx'
import { PageFrame } from '../../components/PageFrame.tsx'
import { Panel } from '../../components/Panel.tsx'
import { useMe } from '../auth/session-context.ts'
import { TeamPageGate } from '../invitations/TeamPageGate.tsx'
import { localInputToIso } from './notice-format.ts'
import { NoticeForm, type NoticeValues } from './NoticeForm.tsx'

/** お知らせを書く。代表・役員・コーチだけ(AC-005-01・04) */
export function NewNoticePage() {
  const { teamId = '' } = useParams()
  return (
    <TeamPageGate key={teamId} teamId={teamId} allowed={(team) => team.permissions.create_notices} deniedText="お知らせは、代表・役員・コーチが送れます。">
      {(team) => <NewNotice team={team} />}
    </TeamPageGate>
  )
}

function NewNotice({ team }: { team: Team }) {
  const me = useMe()
  const navigate = useNavigate()
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function send(values: NoticeValues) {
    if (values.scheduled && values.scheduledAt === '') {
      setErrors({ scheduled_at: ['予約日時を入力してください'] })
      return
    }
    setBusy(true)
    setErrors({})
    setFailure(null)
    const { data, error, response } = await withCsrfRetry(() =>
      api.POST('/api/teams/{team}/notices', {
        params: { path: { team: team.id } },
        body: { title: values.title, body: values.body, target: values.target, scheduled_at: values.scheduled ? localInputToIso(values.scheduledAt) : null },
      }),
    )
    setBusy(false)
    if (data !== undefined) {
      if (data.notice.status === 'scheduled') {
        navigate(`/teams/${team.id}/notices/scheduled`, { replace: true, state: { notice: `「${data.notice.title}」を予約しました。` } })
      } else {
        navigate(`/teams/${team.id}/notices/${data.notice.id}`, { replace: true })
      }
      return
    }
    if (response.status === 422) setErrors(fieldErrors(error))
    else setFailure(errorMessage(error))
  }

  return (
    <PageFrame title={team.name} pageTitle="お知らせを書く" home={`/teams/${team.id}`} signedInAs={me.email} account>
      <Panel tag="お知らせ" meta={team.name} title="お知らせを書く">
        <p className="panel__text">送ったお知らせはアプリに残り、宛先の人にはメールでも届きます。送ったあとは編集できません。</p>
      </Panel>
      {failure !== null && <Alert tone="error">{failure}</Alert>}
      <NoticeForm team={team} mode="new" busy={busy} errors={errors} initial={{ title: '', body: '', target: { type: 'all', values: [] }, scheduled: false, scheduledAt: '' }} onSubmit={(v) => void send(v)} />
      <Link to={`/teams/${team.id}/notices`} className="text-link">
        お知らせ一覧に戻る
      </Link>
    </PageFrame>
  )
}
