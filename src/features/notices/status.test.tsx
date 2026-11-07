import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { Notice, NoticeDeliveryStatus } from '../../api/client.ts'
import { permissions, renderAt, signedIn, signedOut, team } from '../../test/render.tsx'

const U10 = team()
const coachTeam = team({ roles: ['coach'], permissions: permissions({ view_players: true, view_all_players: true, create_notices: true }) })
const parentTeam = team({ roles: ['parent'], permissions: permissions({ view_players: true }) })
const BASE = `/api/teams/${U10.id}`

const notice = (overrides: Partial<Notice> = {}): Notice => ({
  id: 7,
  title: '来週の試合',
  body: '集合は8時です。',
  target: { type: 'all', values: [] },
  status: 'published',
  scheduled_at: null,
  published_at: '2026-11-07T23:00:00+00:00',
  recipient_count: 12,
  author_display_name: '代表 太郎',
  unread: false,
  mine: false,
  ...overrides,
})

const status = (overrides: Partial<NoticeDeliveryStatus> = {}): NoticeDeliveryStatus => ({
  title: '来週の試合',
  state: 'done',
  recipients: 12,
  read: 8,
  unread: 4,
  unread_members: 1,
  delivered: 10,
  pending: 0,
  failed: 1,
  skipped: 1,
  reminders: { sent: 0, max: 3, available: true, reason: null, next_available_at: null },
  ...overrides,
})

const statusHandlers = (s: NoticeDeliveryStatus = status()) => ({
  'GET /api/me': signedIn({ teams: [U10] }),
  [`GET ${BASE}`]: { status: 200, body: U10 },
  [`GET ${BASE}/notices/7/status`]: { status: 200, body: { status: s } },
  [`GET ${BASE}/notices/7/status/unread`]: {
    status: 200,
    body: {
      members: [{ display_name: 'あべ' }],
      former_members: 1,
    },
  },
  [`GET ${BASE}/notices/7/status/failures`]: {
    status: 200,
    body: {
      members: [
        { display_name: 'いとう', status: 'failed', reason: 'invalid_address' },
        { display_name: 'えのき', status: 'skipped', reason: 'undeliverable_address' },
      ],
      former_members: 0,
    },
  },
})

describe('既読', () => {
  afterEach(() => sessionStorage.clear())

  it('AC-006-03 unread notices carry a mark in the list', async () => {
    const list = { notices: [notice({ id: 8, title: '雨天中止', unread: true }), notice()], next_before: null }
    renderAt(`/teams/${U10.id}/notices`, {
      'GET /api/me': signedIn({ teams: [parentTeam] }),
      [`GET ${BASE}`]: { status: 200, body: parentTeam },
      [`GET ${BASE}/notices`]: { status: 200, body: list },
    })

    const items = within(await screen.findByRole('list', { name: 'お知らせ' })).getAllByRole('listitem')
    expect(within(items[0]).getByText('未読')).toBeInTheDocument()
    expect(within(items[1]).queryByText('未読')).not.toBeInTheDocument()
  })

  it('AC-006-03 unread notices carry a mark on the team home', async () => {
    const latest = { notices: [notice({ id: 8, title: '雨天中止', unread: true }), notice()], next_before: null }
    renderAt(`/teams/${U10.id}`, {
      'GET /api/me': signedIn({ teams: [parentTeam] }),
      [`GET ${BASE}`]: { status: 200, body: parentTeam },
      [`GET ${BASE}/notices`]: { status: 200, body: latest },
    })

    const items = within(await screen.findByRole('list', { name: '新しいお知らせ' })).getAllByRole('listitem')
    expect(within(items[0]).getByText('未読')).toBeInTheDocument()
    expect(within(items[1]).queryByText('未読')).not.toBeInTheDocument()
  })

  it('AC-006-02 opening the mail link while logged out comes back to the notice after login', async () => {
    const { router } = renderAt(`/teams/${U10.id}/notices/7`, { 'GET /api/me': signedOut })

    await screen.findByRole('button', { name: 'ログイン用のリンクを送る' })
    expect(router.state.location.pathname).toBe('/login')
    expect(sessionStorage.getItem('team-ops:return-to')).toBe(`/teams/${U10.id}/notices/7`)
  })
})

describe('メールが届いていない', () => {
  it('AC-006-16 tells the member and links to the address change', async () => {
    renderAt(`/teams/${U10.id}`, {
      'GET /api/me': signedIn({ teams: [parentTeam], email_undeliverable: true }),
      [`GET ${BASE}`]: { status: 200, body: parentTeam },
      [`GET ${BASE}/notices`]: { status: 200, body: { notices: [], next_before: null } },
    })

    const text = await screen.findByText('メールが届いていません。メールアドレスを確認してください。')
    const alert = text.closest('[role="status"]') as HTMLElement
    expect(alert).not.toBeNull()
    expect(within(alert).getByRole('link', { name: 'メールアドレスを変更する' })).toHaveAttribute('href', '/settings')
  })

  it('AC-006-17 the notice disappears after the address is changed', async () => {
    renderAt('/settings/email/verify?token=abc', {
      'GET /api/me': signedIn({ teams: [parentTeam], email_undeliverable: true }),
      'POST /api/me/email-changes/consume': signedIn({ teams: [parentTeam], email: 'new@example.invalid', email_undeliverable: false }),
    })

    expect(await screen.findByText('メールが届いていません。メールアドレスを確認してください。')).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: 'メールアドレスを変更する' }))

    expect(await screen.findByRole('heading', { name: 'メールアドレスを変更しました' })).toBeInTheDocument()
    expect(screen.queryByText(/メールが届いていません/)).not.toBeInTheDocument()
  })

  it('AC-006-17 shows nothing once the address works', async () => {
    renderAt(`/teams/${U10.id}`, {
      'GET /api/me': signedIn({ teams: [parentTeam] }),
      [`GET ${BASE}`]: { status: 200, body: parentTeam },
      [`GET ${BASE}/notices`]: { status: 200, body: { notices: [], next_before: null } },
    })

    await screen.findByRole('link', { name: 'お知らせを見る' })
    expect(screen.queryByText(/メールが届いていません/)).not.toBeInTheDocument()
  })
})

describe('配信状況', () => {
  it('AC-006-04 the link is shown to representatives and the authoring coach only', async () => {
    const cases = [
      { t: U10, n: notice(), shown: true },
      { t: coachTeam, n: notice({ mine: true }), shown: true },
      { t: coachTeam, n: notice({ mine: false }), shown: false },
      { t: parentTeam, n: notice(), shown: false },
    ]
    for (const c of cases) {
      renderAt(`/teams/${U10.id}/notices/7`, {
        'GET /api/me': signedIn({ teams: [c.t] }),
        [`GET ${BASE}`]: { status: 200, body: c.t },
        [`GET ${BASE}/notices/7`]: { status: 200, body: { notice: c.n } },
      })
      await screen.findByRole('article', { name: '本文' })
      expect(screen.queryByRole('link', { name: '既読・配信状況を見る' }) !== null).toBe(c.shown)
      cleanup()
    }
  })

  it('AC-006-04 AC-006-05 AC-006-06 shows the counts, unread members and failures with reasons', async () => {
    const { calls } = renderAt(`/teams/${U10.id}/notices/7/status`, statusHandlers())

    expect(await screen.findByLabelText('宛先12人のうち、既読8人、未読4人')).toBeInTheDocument()
    expect(screen.getByText('メールの送信は終わりました')).toBeInTheDocument()
    const unread = within(screen.getByRole('list', { name: '未読の人(1人)' })).getAllByRole('listitem')
    expect(unread).toHaveLength(1)
    expect(unread[0]).toHaveTextContent('あべ')
    // チームを抜けた人は表示名を出さず人数だけ(未読数4のうち、再通知が届くのは1人)
    expect(screen.getByText('ほかに、チームを抜けた未読の人が1人います。')).toBeInTheDocument()
    expect(screen.queryByText('うえだ')).not.toBeInTheDocument()
    const failed = within(screen.getByRole('list', { name: 'メールが届かなかった人(2人)' })).getAllByRole('listitem')
    expect(failed[0]).toHaveTextContent('いとうメールアドレスが存在しない可能性があります')
    expect(failed[1]).toHaveTextContent('えのき以前メールが届かなかったアドレスのため送っていません')
    // 状況を見ても既読にしない:お知らせの詳細は開かない
    expect(calls.some((c) => c.path === `${BASE}/notices/7`)).toBe(false)
  })

  it('AC-006-07 says it is still sending with the sent and waiting counts', async () => {
    renderAt(`/teams/${U10.id}/notices/7/status`, statusHandlers(status({ state: 'sending', delivered: 3, pending: 7 })))

    expect(await screen.findByText('送信中です。送信済み 3人、送信待ち 7人。')).toBeInTheDocument()
    expect(screen.getByText('送信中')).toBeInTheDocument()
  })

  it('AC-006-10 a coach looking at someone else’s notice is told there is no permission', async () => {
    renderAt(`/teams/${U10.id}/notices/7/status`, {
      ...statusHandlers(),
      'GET /api/me': signedIn({ teams: [coachTeam] }),
      [`GET ${BASE}`]: { status: 200, body: coachTeam },
      [`GET ${BASE}/notices/7/status`]: { status: 403, body: { message: 'この操作を行う権限がありません' } },
      [`GET ${BASE}/notices/7/status/unread`]: { status: 403, body: { message: 'この操作を行う権限がありません' } },
      [`GET ${BASE}/notices/7/status/failures`]: { status: 403, body: { message: 'この操作を行う権限がありません' } },
    })

    expect(await screen.findByRole('heading', { name: 'この画面を開く権限がありません' })).toBeInTheDocument()
  })

  it('AC-006-11 AC-006-14 sends a reminder to unread members and says how many were left out', async () => {
    let reminded = false
    const { calls } = renderAt(`/teams/${U10.id}/notices/7/status`, {
      ...statusHandlers(),
      [`GET ${BASE}/notices/7/status`]: () => ({
        status: 200,
        body: { status: reminded ? status({ reminders: { sent: 1, max: 3, available: false, reason: 'interval', next_available_at: '2026-11-08T00:30:00+00:00' } }) : status() },
      }),
      [`POST ${BASE}/notices/7/reminders`]: () => {
        reminded = true
        return { status: 201, body: { reminder: { number: 1, sent: 3, excluded: 1 } } }
      },
    })

    await userEvent.click(await screen.findByRole('button', { name: '未読の1人に再通知する' }))

    expect(await screen.findByText('3人に再通知しました。1人はメールが届かないアドレスなどのため送っていません。')).toBeInTheDocument()
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1)
    // AC-006-12 次に実行できる時刻を出し、押せない
    expect(await screen.findByText('次に再通知できるのは 11/8(日) 09:30 からです。')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '未読の1人に再通知する' })).toBeDisabled()
  })

  it('AC-006-13 AC-006-15 the button cannot be pressed after three reminders or when nobody is unread', async () => {
    renderAt(
      `/teams/${U10.id}/notices/7/status`,
      statusHandlers(status({ reminders: { sent: 3, max: 3, available: false, reason: 'max', next_available_at: null } })),
    )
    expect(await screen.findByText('再通知は3回行いました。これ以上はできません。')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /再通知する/ })).toBeDisabled()
    cleanup()

    renderAt(`/teams/${U10.id}/notices/7/status`, statusHandlers(status({ read: 12, unread: 0, unread_members: 0, reminders: { sent: 0, max: 3, available: false, reason: 'no_unread', next_available_at: null } })))
    expect(await screen.findByText('未読の人がいないため、再通知できません。')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /再通知する/ })).toBeDisabled()
  })

  it('AC-006-12 shows the reason when the server refuses the reminder', async () => {
    renderAt(`/teams/${U10.id}/notices/7/status`, {
      ...statusHandlers(),
      [`POST ${BASE}/notices/7/reminders`]: { status: 409, body: { message: 'この操作は完了できませんでした', errors: { reminder: ['再通知は1時間に1回までです。11月8日 09:30から実行できます。'] } } },
    })

    await userEvent.click(await screen.findByRole('button', { name: '未読の1人に再通知する' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('再通知は1時間に1回までです。11月8日 09:30から実行できます。')
  })
})
