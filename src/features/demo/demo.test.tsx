import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { permissions, renderAt, signedIn, signedOut, team } from '../../test/render.tsx'

const DEMO_ID = '01jcdemo0000000000000000ab'
const demoTeam = team({ id: DEMO_ID, name: 'みどり台FC U-10(デモ)', roles: ['representative'] })
const demoParentTeam = team({ id: DEMO_ID, name: 'みどり台FC U-10(デモ)', roles: ['parent'], permissions: permissions({ view_players: true }) })
const BASE = `/api/teams/${DEMO_ID}`
const demoOn = { 'GET /api/demo': { status: 200, body: { enabled: true, lifetime_hours: 24 } } }
const demoMe = (t = demoTeam) => signedIn({ email: `representative@demo-${DEMO_ID}.invalid`, display_name: '代表 森川 誠', demo_team_id: DEMO_ID, teams: [t] })
const home = (t = demoTeam) => ({
  [`GET ${BASE}`]: { status: 200, body: t },
  [`GET ${BASE}/notices`]: { status: 200, body: { notices: [], next_before: null } },
})

describe('デモとしてログイン', () => {
  it('AC-007-01 AC-007-03 the login page offers the demo login with roles and no email field', async () => {
    renderAt('/login', { ...demoOn, 'GET /api/me': signedOut })

    expect(await screen.findByRole('button', { name: 'デモとしてログイン' })).toBeInTheDocument()
    const roles = within(screen.getByRole('group', { name: 'ログインする役割' })).getAllByRole('radio')
    expect(roles.map((r) => (r as HTMLInputElement).value)).toEqual(['representative', 'officer', 'coach', 'parent'])
    expect(screen.getByRole('radio', { name: /代表/ })).toBeChecked()
    expect(screen.queryByLabelText('メールアドレス')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ログイン用のリンクを送る' })).not.toBeInTheDocument()
  })

  it('AC-007-17 without demo mode the usual email login is shown', async () => {
    renderAt('/login', { 'GET /api/me': signedOut })

    expect(await screen.findByLabelText('メールアドレス')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'デモとしてログイン' })).not.toBeInTheDocument()
  })

  it('AC-007-02 logs in with the chosen role and opens the demo team', async () => {
    const { calls, router } = renderAt('/login', {
      ...demoOn,
      'GET /api/me': signedOut,
      'POST /api/demo/sessions': { status: 201, body: demoMe(demoParentTeam).body },
      ...home(demoParentTeam),
    })

    await userEvent.click(await screen.findByRole('radio', { name: /保護者/ }))
    await userEvent.click(screen.getByRole('button', { name: 'デモとしてログイン' }))

    expect(await screen.findByRole('heading', { name: 'みどり台FC U-10(デモ)' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(`/teams/${DEMO_ID}`)
    expect(calls.find((c) => c.path === '/api/demo/sessions')?.body).toEqual({ role: 'parent' })
  })

  it('AC-007-09 AC-007-10 says when no more demo teams can be made', async () => {
    renderAt('/login', { ...demoOn, 'GET /api/me': signedOut, 'POST /api/demo/sessions': { status: 503, body: { message: 'デモが混み合っています。時間をおいてもう一度お試しください。' } } })

    await userEvent.click(await screen.findByRole('button', { name: 'デモとしてログイン' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('デモが混み合っています。時間をおいてもう一度お試しください。')
  })

  it('AC-007-09 says when too many demo teams were made from one network', async () => {
    renderAt('/login', { ...demoOn, 'GET /api/me': signedOut, 'POST /api/demo/sessions': { status: 429, body: { message: '時間をおいてもう一度お試しください' } } })

    await userEvent.click(await screen.findByRole('button', { name: 'デモとしてログイン' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('時間をおいてもう一度お試しください')
  })

  it('AC-007-08 switching roles after the demo expired returns to the login page with the reason', async () => {
    const { router } = renderAt(`/teams/${DEMO_ID}`, {
      ...demoOn,
      'GET /api/me': demoMe(),
      ...home(),
      'POST /api/demo/sessions/switch': { status: 401, body: { message: 'デモの有効期限が切れました', reason: 'demo_expired' } },
    })

    await userEvent.selectOptions(await screen.findByRole('combobox', { name: '役割' }), 'parent')
    await userEvent.click(screen.getByRole('button', { name: '切り替える' }))

    expect(await screen.findByText('デモの有効期限が切れました。もう一度デモとしてログインしてください。')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('AC-007-08 in demo mode a plain expired login is also told the demo expired', async () => {
    renderAt('/login?expired=1', { ...demoOn, 'GET /api/me': signedOut })

    expect(await screen.findByText('デモの有効期限が切れました。もう一度デモとしてログインしてください。')).toBeInTheDocument()
  })

  it('AC-007-08 an expired demo session returns to the login page with the reason', async () => {
    const { router } = renderAt(`/teams/${DEMO_ID}`, { ...demoOn, 'GET /api/me': { status: 401, body: { message: 'デモの有効期限が切れました', reason: 'demo_expired' } } })

    expect(await screen.findByText('デモの有効期限が切れました。もう一度デモとしてログインしてください。')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(screen.getByRole('button', { name: 'デモとしてログイン' })).toBeInTheDocument()
  })
})

describe('デモ中の表示と役割の切り替え', () => {
  it('AC-007-04 every page says it is a demo while in a demo team', async () => {
    renderAt(`/teams/${DEMO_ID}`, { ...demoOn, 'GET /api/me': demoMe(), ...home() })

    const banner = await screen.findByRole('complementary', { name: 'デモ環境' })
    expect(banner).toHaveTextContent('デモ環境です。入力したデータは24時間後に削除されます')
    expect(within(banner).getByRole('link', { name: '送信されたメール' })).toHaveAttribute('href', `/teams/${DEMO_ID}/demo/mails`)
  })

  it('AC-007-04 a normal team has no demo banner', async () => {
    const normal = team()
    renderAt(`/teams/${normal.id}`, {
      'GET /api/me': signedIn({ teams: [normal] }),
      [`GET /api/teams/${normal.id}`]: { status: 200, body: normal },
      [`GET /api/teams/${normal.id}/notices`]: { status: 200, body: { notices: [], next_before: null } },
    })

    await screen.findByRole('link', { name: 'お知らせを見る' })
    expect(screen.queryByRole('complementary', { name: 'デモ環境' })).not.toBeInTheDocument()
  })

  it('AC-007-05 switches to another role in the same demo team', async () => {
    let parent = false
    const { calls } = renderAt(`/teams/${DEMO_ID}`, {
      ...demoOn,
      'GET /api/me': demoMe(),
      [`GET ${BASE}`]: () => ({ status: 200, body: parent ? demoParentTeam : demoTeam }),
      [`GET ${BASE}/notices`]: { status: 200, body: { notices: [], next_before: null } },
      'POST /api/demo/sessions/switch': () => {
        parent = true
        return { status: 200, body: demoMe(demoParentTeam).body }
      },
    })

    const select = await screen.findByRole('combobox', { name: '役割' })
    expect(select).toHaveValue('representative')
    expect(screen.getByRole('button', { name: '切り替える' })).toBeDisabled()
    await userEvent.selectOptions(select, 'parent')
    await userEvent.click(screen.getByRole('button', { name: '切り替える' }))

    expect(calls.find((c) => c.path === '/api/demo/sessions/switch')?.body).toEqual({ role: 'parent' })
    expect(await screen.findByRole('combobox', { name: '役割' })).toHaveValue('parent')
  })
})

describe('送信されたメール', () => {
  it('AC-007-12 shows the mails of this demo team newest first', async () => {
    const domain = `demo-${DEMO_ID}.invalid`
    renderAt(`/teams/${DEMO_ID}/demo/mails`, {
      ...demoOn,
      'GET /api/me': demoMe(),
      [`GET ${BASE}`]: { status: 200, body: demoTeam },
      [`GET ${BASE}/demo/mails`]: {
        status: 200,
        body: {
          mails: [
            { subject: '【みどり台FC U-10(デモ)】新しい連絡', to: [`parent1@${domain}`, `parent2@${domain}`], sent_at: '2026-11-08T01:00:00Z', text: '日曜は9時集合です。\n雨天中止です。' },
            { subject: '【みどり台FC U-10(デモ)】古い連絡', to: [`parent3@${domain}`], sent_at: '2026-11-08T00:00:00Z', text: '古い本文' },
          ],
        },
      },
    })

    const items = within(await screen.findByRole('list', { name: '送信されたメール' })).getAllByRole('listitem')
    expect(within(items[0]).getByRole('heading')).toHaveTextContent('【みどり台FC U-10(デモ)】新しい連絡')
    expect(items[0]).toHaveTextContent(`宛先 2人:parent1@${domain}、parent2@${domain}`)
    expect(items[0]).toHaveTextContent('日曜は9時集合です。')
    expect(within(items[1]).getByRole('heading')).toHaveTextContent('古い連絡')
  })

  it('AC-007-12 says there is nothing yet and leads to writing a notice', async () => {
    renderAt(`/teams/${DEMO_ID}/demo/mails`, { ...demoOn, 'GET /api/me': demoMe(), [`GET ${BASE}`]: { status: 200, body: demoTeam }, [`GET ${BASE}/demo/mails`]: { status: 200, body: { mails: [] } } })

    expect(await screen.findByText('まだメールはありません。お知らせを送ると、ここに届いたメールが表示されます。')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'お知らせを書く' })).toHaveAttribute('href', `/teams/${DEMO_ID}/notices/new`)
  })
})

describe('デモで使えない操作', () => {
  it('AC-007-15 the email change is not offered', async () => {
    renderAt('/settings', { ...demoOn, 'GET /api/me': demoMe() })

    expect(await screen.findByText('デモでは使えません。デモのメールアドレスは、外部に届かない架空のものです。')).toBeInTheDocument()
    expect(screen.queryByLabelText('新しいメールアドレス')).not.toBeInTheDocument()
  })

  it('AC-007-15 in demo mode the email change is not offered even to a session from before', async () => {
    renderAt('/settings', { ...demoOn, 'GET /api/me': signedIn() })

    expect(await screen.findByText('デモでは使えません。デモのメールアドレスは、外部に届かない架空のものです。')).toBeInTheDocument()
    expect(screen.queryByLabelText('新しいメールアドレス')).not.toBeInTheDocument()
  })

  it('AC-007-15 in demo mode a new team cannot be created even by a session from before', async () => {
    renderAt('/teams/new', { ...demoOn, 'GET /api/me': signedIn() })

    expect(await screen.findByRole('heading', { name: 'デモでは使えません' })).toBeInTheDocument()
    expect(screen.queryByLabelText('チーム名')).not.toBeInTheDocument()
  })

  it('AC-007-15 a new team cannot be created', async () => {
    renderAt('/teams/new', { ...demoOn, 'GET /api/me': demoMe() })

    expect(await screen.findByRole('heading', { name: 'デモでは使えません' })).toBeInTheDocument()
    expect(screen.queryByLabelText('チーム名')).not.toBeInTheDocument()
  })

  it('AC-007-14 an invitation link cannot be used to join in the demo', async () => {
    renderAt(`/join?token=${'a'.repeat(64)}`, {
      ...demoOn,
      'GET /api/me': signedOut,
      'POST /api/invitations/preview': { status: 200, body: { team: { name: 'みどり台FC U-10(デモ)', sport: 'soccer' }, relation: null, team_id: null } },
    })

    expect(await screen.findByText(/デモでは、招待リンクからチームに参加できません/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ログインして参加を申請する' })).not.toBeInTheDocument()
  })

  it('AC-007-16 the import page offers the sample CSV', async () => {
    const rep = team({ id: DEMO_ID, roles: ['representative'], permissions: permissions({ manage_players: true, view_players: true, view_all_players: true }) })
    renderAt(`/teams/${DEMO_ID}/players/import`, { ...demoOn, 'GET /api/me': demoMe(rep), [`GET ${BASE}`]: { status: 200, body: rep } })

    expect(await screen.findByRole('link', { name: '試すためのサンプル(架空の選手20人)をダウンロード' })).toHaveAttribute('href', `${BASE}/players/import/sample`)
  })
})
