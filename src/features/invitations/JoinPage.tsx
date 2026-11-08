import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { api, errorMessage, fieldErrors, withCsrfRetry, type InvitationPreview } from '../../api/client.ts'
import { Alert } from '../../components/Alert.tsx'
import { PageFrame } from '../../components/PageFrame.tsx'
import { Panel } from '../../components/Panel.tsx'
import { useDemoMode } from '../demo/demo-mode.ts'
import { TextField } from '../../components/TextField.tsx'
import { useFocusFirstInvalid } from '../../components/use-focus-first-invalid.ts'
import { Loading, Unavailable } from '../auth/guards.tsx'
import { saveReturnTo } from '../auth/return-to.ts'
import { sessionSettled, useSession } from '../auth/session-context.ts'
import { useLinkToken } from '../auth/use-link-token.ts'
import { SPORT_LABELS } from '../teams/sports.ts'

const INVALID = 'リンクが無効です。チームの役員に新しいリンクを依頼してください'

type Preview = { status: 'loading' } | { status: 'invalid'; message: string } | { status: 'ready'; preview: InvitationPreview }

/**
 * 招待リンクから開く画面(AC-002-05〜10・16)。チーム名を見せ、ログインしていれば参加申請のフォームを出す。
 * リンクのトークンは読んだらすぐ URL から消す(001 の D7 と同じ)。
 */
export function JoinPage() {
  const demo = useDemoMode()
  const token = useLinkToken()
  const { state } = useSession()
  const [preview, setPreview] = useState<Preview>(token === '' ? { status: 'invalid', message: INVALID } : { status: 'loading' })
  const signedIn = state.status === 'signed-in'

  useEffect(() => {
    if (token === '' || state.status === 'loading') return
    let active = true
    // The answer depends on who is logged in, so ask once the session is known and settled
    void sessionSettled()
      .then(() => withCsrfRetry(() => api.POST('/api/invitations/preview', { body: { token } })))
      .then(({ data, response, error }) => {
        if (!active) return
        if (data !== undefined) setPreview({ status: 'ready', preview: data })
        else setPreview({ status: 'invalid', message: response.status === 410 ? INVALID : errorMessage(error) })
      })
    return () => {
      active = false
    }
  }, [token, state.status, signedIn])

  if (state.status === 'loading' || preview.status === 'loading' || demo === null) return <Loading />
  if (state.status === 'unavailable') return <Unavailable />

  if (preview.status === 'invalid') {
    return (
      <PageFrame title="チーム運営" pageTitle="リンクが無効です" signedInAs={signedIn ? state.me.email : undefined}>
        <Panel tag="招待" title="リンクが無効です">
          <p className="panel__text">{preview.message}</p>
        </Panel>
      </PageFrame>
    )
  }

  const { team, relation, team_id: teamId } = preview.preview

  // デモでは招待リンクから参加できない(参加にはメールでのログインが要る、AC-007-14)
  if (demo && relation !== 'member') {
    return (
      <PageFrame title="チーム運営" pageTitle="デモでは参加できません" signedInAs={signedIn ? state.me.email : undefined}>
        <Panel tag="招待" meta={SPORT_LABELS[team.sport]} title={team.name}>
          <p className="panel__text">
            デモでは、招待リンクからチームに参加できません。参加にはメールアドレスでのログインが必要なためです。承認の操作は、デモチームの「参加申請」に用意した申請で試せます。
          </p>
        </Panel>
      </PageFrame>
    )
  }

  // Already a member: go straight to the team (AC-002-08)
  if (relation === 'member' && teamId !== null) {
    return <Navigate to={`/teams/${teamId}`} replace />
  }

  if (state.status === 'signed-out') {
    return <SignInToJoin token={token} teamName={team.name} sport={SPORT_LABELS[team.sport]} />
  }

  if (relation === 'pending') {
    return <Pending teamName={team.name} email={state.me.email} />
  }

  return <JoinForm token={token} teamName={team.name} sport={SPORT_LABELS[team.sport]} />
}

function SignInToJoin({ token, teamName, sport }: { token: string; teamName: string; sport: string }) {
  const navigate = useNavigate()

  function signIn() {
    // Come back here after logging in, even if the login mail is opened elsewhere (AC-001-19)
    saveReturnTo(`/join?token=${token}`)
    navigate('/login')
  }

  return (
    <PageFrame title="チーム運営" pageTitle={`${teamName}への招待`}>
      <Panel tag="招待" meta={sport} title={teamName}>
        <p className="panel__text">このチームへの招待リンクです。参加を申請するには、メールアドレスでログインしてください。はじめての方も同じ手順で登録できます。</p>
        <button type="button" className="button button--on-panel" onClick={signIn}>
          ログインして参加を申請する
        </button>
      </Panel>
    </PageFrame>
  )
}

function Pending({ teamName, email }: { teamName: string; email: string }) {
  return (
    <PageFrame title="チーム運営" pageTitle="承認待ちです" signedInAs={email} account>
      <Panel tag="参加申請" meta={teamName} title="承認待ちです">
        <p className="panel__text">「{teamName}」への参加を申請しています。代表または役員が承認すると、メールでお知らせします。</p>
      </Panel>
      <Link to="/" className="text-link">
        ホームに戻る
      </Link>
    </PageFrame>
  )
}

function JoinForm({ token, teamName, sport }: { token: string; teamName: string; sport: string }) {
  const { state, refresh } = useSession()
  const navigate = useNavigate()
  const me = state.status === 'signed-in' ? state.me : null
  const [displayName, setDisplayName] = useState(me?.display_name ?? '')
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const form = useRef<HTMLFormElement>(null)
  useFocusFirstInvalid(form, errors)

  async function apply(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setErrors({})
    setFailure(null)
    const { data, response, error } = await withCsrfRetry(() =>
      api.POST('/api/invitations/applications', {
        body: { token, display_name: displayName, message: message.trim() === '' ? null : message },
      }),
    )
    setBusy(false)
    if (data !== undefined) {
      setSent(true)
      void refresh() // the start page lists the request
    } else if (response.status === 409 && error !== undefined && 'team_id' in error) {
      navigate(`/teams/${error.team_id}`, { replace: true })
    } else if (response.status === 422) {
      setErrors(fieldErrors(error))
    } else if (response.status === 410) {
      setFailure(INVALID)
    } else {
      setFailure(errorMessage(error))
    }
  }

  if (me === null) return null

  if (sent) {
    return <Pending teamName={teamName} email={me.email} />
  }

  return (
    <PageFrame title="チーム運営" pageTitle={`${teamName}への参加申請`} signedInAs={me.email} account>
      <Panel tag="参加申請" meta={sport} title={teamName}>
        <p className="panel__text">
          参加を申請すると、チームの代表または役員が確認して承認します。心当たりのないチームからの招待なら、申請しないでください。
        </p>
      </Panel>
      {failure !== null && <Alert tone="error">{failure}</Alert>}
      <form ref={form} className="sheet" onSubmit={(e) => void apply(e)} noValidate>
        <TextField
          label="表示名"
          name="display_name"
          autoComplete="name"
          required
          maxLength={30}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          hint="チームのメンバーに表示される名前です。30文字まで。ほかのチームでも同じ名前になります"
          error={errors.display_name?.[0]}
        />
        <TextField
          label="ひとこと(任意)"
          name="message"
          maxLength={100}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          hint="100文字まで。例:3年 山田太郎の母です"
          error={errors.message?.[0]}
        />
        <button type="submit" className="button button--accent" disabled={busy}>
          {busy ? '申請しています' : '参加を申請する'}
        </button>
      </form>
    </PageFrame>
  )
}
