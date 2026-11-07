import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { InvitationPreview, JoinRequest } from '../../api/client.ts'
import { me, renderAt, signedIn, signedOut, team } from '../../test/render.tsx'

const TOKEN = 'a'.repeat(64)
const U10 = team()
const URL_ = `http://localhost:5173/join?token=${TOKEN}`
const invitation = { url: URL_, expires_at: '2026-11-14T09:00:00+09:00' }
const coachTeam = team({ roles: ['coach'], permissions: { manage_invitation: false, review_join_requests: false, manage_players: false, view_all_players: true } })

const preview = (overrides: Partial<InvitationPreview> = {}) => ({
  status: 200,
  body: { team: { name: 'あおば台FC U-10', sport: 'soccer' }, relation: null, team_id: null, ...overrides },
})

beforeEach(() => sessionStorage.clear())

describe('メンバーを招待(代表・役員)', () => {
  it('AC-002-01 issues a link and shows the URL and a QR code of the same URL', async () => {
    const { calls } = renderAt(`/teams/${U10.id}/invitation`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET /api/teams/${U10.id}`]: { status: 200, body: U10 },
      [`GET /api/teams/${U10.id}/invitation`]: { status: 200, body: { invitation: null } },
      [`POST /api/teams/${U10.id}/invitation`]: { status: 201, body: { invitation } },
    })

    await userEvent.click(await screen.findByRole('button', { name: '招待リンクを発行する' }))

    expect(await screen.findByText(URL_)).toBeInTheDocument()
    expect(await screen.findByRole('img', { name: '招待リンクのQRコード' })).toHaveAttribute('src', expect.stringContaining('data:image/svg+xml'))
    expect(screen.getByText(/有効期限:11月14日/)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('招待リンクを発行しました。')
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1)
  })

  it('AC-002-02 issuing again says the previous link stops working', async () => {
    renderAt(`/teams/${U10.id}/invitation`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET /api/teams/${U10.id}`]: { status: 200, body: U10 },
      [`GET /api/teams/${U10.id}/invitation`]: { status: 200, body: { invitation } },
      [`POST /api/teams/${U10.id}/invitation`]: { status: 201, body: { invitation: { ...invitation, url: URL_.replace('aaaa', 'bbbb') } } },
    })

    await userEvent.click(await screen.findByRole('button', { name: /新しいリンクを発行する/ }))

    expect(await screen.findByText('新しいリンクを発行しました。前のリンクは使えなくなりました。')).toBeInTheDocument()
    expect(screen.queryByText(URL_)).not.toBeInTheDocument()
  })

  it('AC-002-03 revoking the link removes it', async () => {
    renderAt(`/teams/${U10.id}/invitation`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET /api/teams/${U10.id}`]: { status: 200, body: U10 },
      [`GET /api/teams/${U10.id}/invitation`]: { status: 200, body: { invitation } },
      [`DELETE /api/teams/${U10.id}/invitation`]: { status: 204 },
    })

    await userEvent.click(await screen.findByRole('button', { name: 'リンクを無効にする' }))

    expect(await screen.findByRole('heading', { name: '有効な招待リンクはありません' })).toBeInTheDocument()
    expect(screen.queryByText(URL_)).not.toBeInTheDocument()
  })

  it('AC-002-04 a coach or parent sees no invite or review links, and the page itself refuses', async () => {
    renderAt(`/teams/${U10.id}/invitation`, {
      'GET /api/me': signedIn({ teams: [coachTeam] }),
      [`GET /api/teams/${U10.id}`]: { status: 200, body: coachTeam },
    })

    expect(await screen.findByRole('heading', { name: 'この画面を開く権限がありません' })).toBeInTheDocument()
  })

  it('AC-002-04 the team home shows the member links only to people who may use them', async () => {
    renderAt(`/teams/${U10.id}`, {
      'GET /api/me': signedIn({ teams: [coachTeam] }),
      [`GET /api/teams/${U10.id}`]: { status: 200, body: coachTeam },
    })

    expect(await screen.findByText('あなたの役割:コーチ')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'メンバーを招待する' })).not.toBeInTheDocument()
  })

  it('AC-002-01 the representative finds the invite page from the team home', async () => {
    renderAt(`/teams/${U10.id}`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET /api/teams/${U10.id}`]: { status: 200, body: U10 },
    })

    expect(await screen.findByRole('link', { name: 'メンバーを招待する' })).toHaveAttribute('href', `/teams/${U10.id}/invitation`)
    expect(screen.getByRole('link', { name: '承認待ちの申請を見る' })).toHaveAttribute('href', `/teams/${U10.id}/join-requests`)
  })
})

describe('招待リンクを開く', () => {
  it('AC-002-05 logged out: shows the team name, removes the token from the URL and goes to login', async () => {
    const { router, calls } = renderAt(`/join?token=${TOKEN}`, {
      'GET /api/me': signedOut,
      'POST /api/invitations/preview': preview(),
    })

    expect(await screen.findByRole('heading', { name: 'あおば台FC U-10' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('') // D7
    expect(calls.find((c) => c.path === '/api/invitations/preview')?.body).toEqual({ token: TOKEN })

    await userEvent.click(screen.getByRole('button', { name: 'ログインして参加を申請する' }))

    expect(await screen.findByRole('heading', { name: 'メールアドレスでログイン' })).toBeInTheDocument()
    expect(sessionStorage.getItem('team-ops:return-to')).toBe(`/join?token=${TOKEN}`)
  })

  it('AC-001-19 AC-002-05 a new user coming back from the login mail goes straight to the request form', async () => {
    renderAt('/login/verify?token=login-token', {
      'GET /api/me': signedOut,
      'POST /api/auth/login-links/consume': {
        status: 200,
        body: { ...me({ display_name: null, needs_display_name: true }), return_to: `/join?token=${TOKEN}` },
      },
      'POST /api/invitations/preview': preview({ relation: 'none' }),
    })

    await userEvent.click(await screen.findByRole('button', { name: 'ログインする' }))

    // the display name is asked on the request form, not on a separate page (002 decision 5)
    expect(await screen.findByRole('heading', { name: 'あおば台FC U-10' })).toBeInTheDocument()
    expect(screen.getByLabelText('表示名')).toHaveValue('')
    expect(screen.queryByRole('heading', { name: '表示名を登録してください' })).not.toBeInTheDocument()
  })

  it('AC-002-07 an expired or revoked link says to ask for a new one', async () => {
    renderAt(`/join?token=${TOKEN}`, {
      'GET /api/me': signedIn(),
      'POST /api/invitations/preview': { status: 410, body: { message: 'リンクが無効です。チームの役員に新しいリンクを依頼してください' } },
    })

    expect(await screen.findByRole('heading', { name: 'リンクが無効です' })).toBeInTheDocument()
    expect(screen.getByText('リンクが無効です。チームの役員に新しいリンクを依頼してください')).toBeInTheDocument()
  })

  it('AC-002-08 a member goes to the team instead of the form', async () => {
    const { router } = renderAt(`/join?token=${TOKEN}`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      'POST /api/invitations/preview': preview({ relation: 'member', team_id: U10.id }),
      [`GET /api/teams/${U10.id}`]: { status: 200, body: U10 },
    })

    expect(await screen.findByRole('heading', { name: 'あおば台FC U-10', level: 1 })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(`/teams/${U10.id}`)
  })

  it('AC-002-06 sends the display name and message, then shows it is waiting for approval', async () => {
    const { calls } = renderAt(`/join?token=${TOKEN}`, {
      'GET /api/me': signedIn({ display_name: '山田 花子' }),
      'POST /api/invitations/preview': preview({ relation: 'none' }),
      'POST /api/invitations/applications': { status: 201, body: { status: 'pending', team: { name: 'あおば台FC U-10' } } },
    })

    expect(await screen.findByLabelText('表示名')).toHaveValue('山田 花子')
    await userEvent.type(screen.getByLabelText('ひとこと(任意)'), '3年 山田太郎の母です')
    await userEvent.click(screen.getByRole('button', { name: '参加を申請する' }))

    expect(await screen.findByRole('heading', { name: '承認待ちです' })).toBeInTheDocument()
    expect(calls.find((c) => c.path === '/api/invitations/applications')?.body).toEqual({
      token: TOKEN,
      display_name: '山田 花子',
      message: '3年 山田太郎の母です',
    })
  })

  it('AC-002-06 shows the field errors from the API', async () => {
    renderAt(`/join?token=${TOKEN}`, {
      'GET /api/me': signedIn(),
      'POST /api/invitations/preview': preview({ relation: 'none' }),
      'POST /api/invitations/applications': { status: 422, body: { message: '入力内容を確認してください', errors: { message: ['ひとことは100文字以内で入力してください。'] } } },
    })

    await userEvent.click(await screen.findByRole('button', { name: '参加を申請する' }))

    expect(await screen.findByText('ひとことは100文字以内で入力してください。')).toBeInTheDocument()
    expect(screen.getByLabelText('ひとこと(任意)')).toHaveFocus()
  })

  it('AC-002-16 someone whose earlier request was not approved can apply again', async () => {
    renderAt(`/join?token=${TOKEN}`, {
      'GET /api/me': signedIn({ join_requests: [{ id: 2, team_name: 'あおば台FC U-10', status: 'rejected', created_at: '2026-11-06T10:00:00+09:00' }] }),
      'POST /api/invitations/preview': preview({ relation: 'none' }),
      'POST /api/invitations/applications': { status: 201, body: { status: 'pending', team: { name: 'あおば台FC U-10' } } },
    })

    await userEvent.click(await screen.findByRole('button', { name: '参加を申請する' }))

    expect(await screen.findByRole('heading', { name: '承認待ちです' })).toBeInTheDocument()
  })

  it('AC-002-06 the request form warns not to apply to a team the user does not know', async () => {
    renderAt(`/join?token=${TOKEN}`, {
      'GET /api/me': signedIn(),
      'POST /api/invitations/preview': preview({ relation: 'none' }),
    })

    expect(await screen.findByText(/心当たりのないチームからの招待なら、申請しないでください/)).toBeInTheDocument()
  })

  it('AC-002-18 more than 3 requests a day to one team: says to try later', async () => {
    renderAt(`/join?token=${TOKEN}`, {
      'GET /api/me': signedIn(),
      'POST /api/invitations/preview': preview({ relation: 'none' }),
      'POST /api/invitations/applications': { status: 429, body: { message: 'このチームへの申請は1日3回までです。時間をおいてもう一度お試しください' } },
    })

    await userEvent.click(await screen.findByRole('button', { name: '参加を申請する' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('このチームへの申請は1日3回までです')
  })

  it('AC-002-09 someone already waiting sees that instead of the form', async () => {
    renderAt(`/join?token=${TOKEN}`, {
      'GET /api/me': signedIn(),
      'POST /api/invitations/preview': preview({ relation: 'pending' }),
    })

    expect(await screen.findByRole('heading', { name: '承認待ちです' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '参加を申請する' })).not.toBeInTheDocument()
  })

  it('AC-002-10 too many requests on the link: says applications are stopped', async () => {
    renderAt(`/join?token=${TOKEN}`, {
      'GET /api/me': signedIn(),
      'POST /api/invitations/preview': preview({ relation: 'none' }),
      'POST /api/invitations/applications': { status: 429, body: { message: 'このリンクへの申請が多すぎるため、受け付けを止めています。チームの役員にお問い合わせください' } },
    })

    await userEvent.click(await screen.findByRole('button', { name: '参加を申請する' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('受け付けを止めています')
  })
})

describe('承認待ちの申請(代表・役員)', () => {
  const request: JoinRequest = { id: 7, display_name: '山田 花子', message: '3年 山田太郎の母です', created_at: '2026-11-07T10:30:00+09:00' }
  const handlers = {
    'GET /api/me': signedIn({ teams: [U10] }),
    [`GET /api/teams/${U10.id}`]: { status: 200, body: U10 },
    [`GET /api/teams/${U10.id}/join-requests`]: { status: 200, body: { join_requests: [request] } },
  }

  it('AC-002-11 lists the name, message and time of each request', async () => {
    renderAt(`/teams/${U10.id}/join-requests`, handlers)

    const card = await screen.findByRole('region', { name: '山田 花子' })
    expect(within(card).getByText('3年 山田太郎の母です')).toBeInTheDocument()
    expect(within(card).getByText(/申請日時:11月7日/)).toBeInTheDocument()
  })

  it('AC-002-12 AC-002-14 approves with parent and coach; officer and representative are not offered', async () => {
    const { calls } = renderAt(`/teams/${U10.id}/join-requests`, {
      ...handlers,
      [`POST /api/teams/${U10.id}/join-requests/7/approve`]: { status: 204 },
    })

    const card = await screen.findByRole('region', { name: '山田 花子' })
    const roles = within(card).getAllByRole('checkbox')
    expect(roles.map((r) => r.closest('label')?.textContent)).toEqual(['保護者', 'コーチ'])
    await userEvent.click(within(card).getByRole('checkbox', { name: 'コーチ' }))
    await userEvent.click(within(card).getByRole('button', { name: '承認する' }))

    expect(await screen.findByText('山田 花子さんを承認しました。')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '山田 花子' })).not.toBeInTheDocument()
    expect(calls.find((c) => c.path.endsWith('/approve'))?.body).toEqual({ roles: ['parent', 'coach'] })
  })

  it('AC-002-12 asks for at least one role', async () => {
    const { calls } = renderAt(`/teams/${U10.id}/join-requests`, handlers)

    const card = await screen.findByRole('region', { name: '山田 花子' })
    await userEvent.click(within(card).getByRole('checkbox', { name: '保護者' }))
    await userEvent.click(within(card).getByRole('button', { name: '承認する' }))

    expect(await within(card).findByText('役割を1つ以上選んでください')).toBeInTheDocument()
    expect(calls.some((c) => c.path.endsWith('/approve'))).toBe(false)
  })

  it('AC-002-13 rejects without telling the applicant', async () => {
    renderAt(`/teams/${U10.id}/join-requests`, {
      ...handlers,
      [`POST /api/teams/${U10.id}/join-requests/7/reject`]: { status: 204 },
    })

    const card = await screen.findByRole('region', { name: '山田 花子' })
    await userEvent.click(within(card).getByRole('button', { name: '却下する' }))

    expect(await screen.findByText('山田 花子さんの申請を却下しました。')).toBeInTheDocument()
  })

  it('AC-002-11 with no requests, offers to invite members', async () => {
    renderAt(`/teams/${U10.id}/join-requests`, {
      ...handlers,
      [`GET /api/teams/${U10.id}/join-requests`]: { status: 200, body: { join_requests: [] } },
    })

    expect(await screen.findByRole('heading', { name: '承認待ちの申請はありません' })).toBeInTheDocument()
  })
})

describe('申請した人の画面', () => {
  it('AC-002-09 AC-002-13 AC-002-15 the start page shows the state of each request', async () => {
    renderAt('/start', {
      'GET /api/me': signedIn({
        join_requests: [
          { id: 3, team_name: 'あおば台FC U-12', status: 'pending', created_at: '2026-11-07T10:00:00+09:00' },
          { id: 2, team_name: 'あおば台FC U-10', status: 'rejected', created_at: '2026-11-06T10:00:00+09:00' },
          { id: 1, team_name: 'みどり野FC', status: 'cancelled', created_at: '2026-10-01T10:00:00+09:00' },
        ],
      }),
    })

    expect(await screen.findByText('「あおば台FC U-12」に参加を申請しています。承認されると、メールでお知らせします。')).toBeInTheDocument()
    expect(screen.getByText('「あおば台FC U-10」への参加は承認されませんでした。')).toBeInTheDocument()
    expect(screen.getByText('「みどり野FC」への申請は、14日間承認されなかったため取り消されました。')).toBeInTheDocument()
  })
})
